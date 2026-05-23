import { supabase } from "./supabase";
import type { DocumentInsert, DocumentRow, DocumentUpdate } from "@/types/database";

export type { DocumentInsert, DocumentRow, DocumentUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const DOCUMENT_BUCKET = "grant-documents";

export type DocumentFilters = {
  search?: string;
  documentType?: string;
  relatedProjectId?: string;
  relatedGrantId?: string;
  relatedFunderId?: string;
  relatedApplicationId?: string;
  includeArchived?: boolean;
};

export type GrantDocumentLookup = {
  grantId: string;
  funderId?: string | null;
  title?: string | null;
  funderName?: string | null;
  sourceUrl?: string | null;
  applicationUrl?: string | null;
};

export async function listDocuments(filters?: DocumentFilters): Promise<DocumentRow[]> {
  let query = db.from("documents").select("*").order("created_at", { ascending: false });
  if (!filters?.includeArchived) query = query.is("archived_at", null);
  if (filters?.documentType && filters.documentType !== "all") query = query.eq("document_type", filters.documentType);
  if (filters?.relatedProjectId && filters.relatedProjectId !== "all") query = query.eq("related_project_id", filters.relatedProjectId);
  if (filters?.relatedGrantId && filters.relatedGrantId !== "all") query = query.eq("related_grant_id", filters.relatedGrantId);
  if (filters?.relatedFunderId) query = query.eq("related_funder_id", filters.relatedFunderId);
  if (filters?.relatedApplicationId) query = query.eq("related_application_id", filters.relatedApplicationId);
  const result: SupabaseResult<DocumentRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  const rows = result.data ?? [];
  const q = filters?.search?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((doc) =>
    [doc.title, doc.file_name, doc.source_url, doc.extraction_status, doc.document_type]
      .some((value) => (value ?? "").toLowerCase().includes(q))
  );
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsAny(haystack: string, needles: string[]) {
  return needles.some((needle) => needle.length >= 8 && haystack.includes(needle));
}

export async function listGrantDocuments(input: GrantDocumentLookup): Promise<DocumentRow[]> {
  const queries: Promise<DocumentRow[]>[] = [listDocuments({ relatedGrantId: input.grantId })];
  if (input.funderId) queries.push(listDocuments({ relatedFunderId: input.funderId }));

  const rows = (await Promise.all(queries)).flat();
  const byId = new Map(rows.map((doc) => [doc.id, doc]));
  const docs = [...byId.values()];
  const sourceUrls = [input.sourceUrl, input.applicationUrl].filter(Boolean) as string[];
  const needles = [
    normalize(input.title),
    normalize(input.funderName),
    ...sourceUrls.map(normalize),
  ].filter(Boolean);

  return docs.filter((doc) => {
    if (doc.related_grant_id === input.grantId) return true;
    if (input.funderId && doc.related_funder_id === input.funderId) {
      const haystack = normalize(`${doc.title} ${doc.file_name ?? ""} ${doc.source_url ?? ""} ${JSON.stringify(doc.metadata ?? {})}`);
      return containsAny(haystack, needles) || sourceUrls.some((url) => doc.source_url === url);
    }
    return sourceUrls.some((url) => doc.source_url === url);
  });
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  const result: SupabaseResult<DocumentRow | null> = await db.from("documents").select("*").eq("id", id).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function createDocument(input: Omit<DocumentInsert, "created_at" | "updated_at">): Promise<DocumentRow> {
  const result: SupabaseResult<DocumentRow> = await db.from("documents").insert(input).select().single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateDocument(id: string, updates: Omit<DocumentUpdate, "id" | "created_at">): Promise<DocumentRow> {
  const result: SupabaseResult<DocumentRow> = await db
    .from("documents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveDocument(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db
    .from("documents")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteDocument(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("documents").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName ? `.${fromName}` : "";
}

function extractionSupport(fileName: string, mimeType?: string | null): "txt" | "pdf" | "docx" | "unsupported" {
  const name = fileName.toLowerCase();
  if ((mimeType ?? "").startsWith("text/") || name.endsWith(".txt")) return "txt";
  if (name.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return "unsupported";
}

async function extractTextFromFile(file: File): Promise<{ text: string | null; status: DocumentRow["extraction_status"]; error: string | null }> {
  const support = extractionSupport(file.name, file.type);
  if (support === "txt") return { text: await file.text(), status: "completed", error: null };
  if (support === "pdf") return { text: null, status: "unsupported", error: "PDF extraction is not enabled in V0.9. Export and analyze externally, or paste extracted text later." };
  if (support === "docx") return { text: null, status: "unsupported", error: "DOCX extraction is not enabled in V0.9. Export and analyze externally, or paste extracted text later." };
  return { text: null, status: "unsupported", error: "This file type is not supported for browser extraction." };
}

export async function uploadDocumentFile(
  file: File,
  metadata: Omit<DocumentInsert, "id" | "created_at" | "updated_at" | "file_name" | "file_path" | "mime_type" | "file_size_bytes" | "extracted_text" | "extraction_status" | "extraction_error">
): Promise<DocumentRow> {
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filePath = `${id}/${Date.now()}-${safeName}`;
  const upload = await supabase.storage.from(DOCUMENT_BUCKET).upload(filePath, file, { upsert: false, contentType: file.type || undefined });
  if (upload.error) throw new Error(upload.error.message);
  const extraction = await extractTextFromFile(file);
  return createDocument({
    ...metadata,
    id,
    file_name: file.name,
    file_path: filePath,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    extracted_text: extraction.text,
    extraction_status: extraction.status,
    extraction_error: extraction.error,
  });
}

export async function getDocumentSignedUrl(doc: DocumentRow): Promise<string | null> {
  if (doc.source_url) return doc.source_url;
  if (doc.file_url) return doc.file_url;
  if (!doc.file_path) return null;
  const result = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.file_path, 60 * 15);
  if (result.error) throw new Error(result.error.message);
  return result.data?.signedUrl ?? null;
}

export async function extractDocumentText(documentId: string): Promise<DocumentRow> {
  const doc = await getDocument(documentId);
  if (!doc) throw new Error("Document not found");
  if (!doc.file_path) {
    return updateDocument(documentId, { extraction_status: "unsupported", extraction_error: "No uploaded file is available for extraction." });
  }
  const support = extractionSupport(doc.file_name ?? "", doc.mime_type);
  if (support !== "txt") {
    return updateDocument(documentId, {
      extraction_status: "unsupported",
      extraction_error: support === "pdf" || support === "docx"
        ? `${support.toUpperCase()} extraction is not enabled in V0.9.`
        : "This file type is not supported for browser extraction.",
    });
  }
  await updateDocument(documentId, { extraction_status: "pending", extraction_error: null });
  const download = await supabase.storage.from(DOCUMENT_BUCKET).download(doc.file_path);
  if (download.error) {
    return updateDocument(documentId, { extraction_status: "failed", extraction_error: download.error.message });
  }
  try {
    const text = await download.data.text();
    return updateDocument(documentId, { extracted_text: text, extraction_status: "completed", extraction_error: null });
  } catch (err) {
    return updateDocument(documentId, { extraction_status: "failed", extraction_error: err instanceof Error ? err.message : "Extraction failed" });
  }
}

export function exportDocumentPayload(doc: DocumentRow) {
  return {
    exported_at: new Date().toISOString(),
    package_type: "document",
    app: "Grant OS",
    records: { document: doc },
  };
}

export function downloadDocumentJson(doc: DocumentRow) {
  const blob = new Blob([JSON.stringify(exportDocumentPayload(doc), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grant-os-document-${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || doc.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
