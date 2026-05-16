import { supabase } from "./supabase";
import type {
  ApplicationRow,
  ApplicationInsert,
  ApplicationUpdate,
  ApplicationQuestionRow,
  ApplicationQuestionInsert,
  ApplicationQuestionUpdate,
  ApplicationRequiredDocumentRow,
  ApplicationRequiredDocumentInsert,
  ApplicationRequiredDocumentUpdate,
} from "@/types/database";

export type {
  ApplicationRow,
  ApplicationInsert,
  ApplicationUpdate,
  ApplicationQuestionRow,
  ApplicationQuestionInsert,
  ApplicationQuestionUpdate,
  ApplicationRequiredDocumentRow,
  ApplicationRequiredDocumentInsert,
  ApplicationRequiredDocumentUpdate,
};

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================================
// Applications
// ============================================================

export type ListApplicationsOptions = {
  includeSoftArchived?: boolean;
};

export async function listApplications(opts?: ListApplicationsOptions): Promise<ApplicationRow[]> {
  let query = db.from("applications").select("*").order("created_at", { ascending: false });
  if (!opts?.includeSoftArchived) {
    query = query.is("archived_at", null);
  }
  const result: SupabaseResult<ApplicationRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getApplicationById(id: string): Promise<ApplicationRow | null> {
  const result: SupabaseResult<ApplicationRow | null> = await db
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listApplicationsByGrant(grantId: string): Promise<ApplicationRow[]> {
  const result: SupabaseResult<ApplicationRow[]> = await db
    .from("applications")
    .select("*")
    .eq("grant_id", grantId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function listApplicationsByProject(projectId: string): Promise<ApplicationRow[]> {
  const result: SupabaseResult<ApplicationRow[]> = await db
    .from("applications")
    .select("*")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createApplication(
  input: Omit<ApplicationInsert, "id" | "created_at" | "updated_at">
): Promise<ApplicationRow> {
  const result: SupabaseResult<ApplicationRow> = await db
    .from("applications")
    .insert(input)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateApplication(
  id: string,
  updates: Omit<ApplicationUpdate, "id" | "created_at">
): Promise<ApplicationRow> {
  const result: SupabaseResult<ApplicationRow> = await db
    .from("applications")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveApplication(id: string): Promise<void> {
  const now = new Date().toISOString();
  const result: SupabaseResult<null> = await db
    .from("applications")
    .update({ archived_at: now, status: "Archived", updated_at: now })
    .eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteApplication(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("applications").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

// ============================================================
// Application Questions
// ============================================================

export async function listApplicationQuestions(applicationId: string): Promise<ApplicationQuestionRow[]> {
  const result: SupabaseResult<ApplicationQuestionRow[]> = await db
    .from("application_questions")
    .select("*")
    .eq("application_id", applicationId)
    .order("sort_order", { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createApplicationQuestion(
  input: Omit<ApplicationQuestionInsert, "id" | "created_at" | "updated_at">
): Promise<ApplicationQuestionRow> {
  const result: SupabaseResult<ApplicationQuestionRow> = await db
    .from("application_questions")
    .insert(input)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateApplicationQuestion(
  id: string,
  updates: Omit<ApplicationQuestionUpdate, "id" | "created_at">
): Promise<ApplicationQuestionRow> {
  const result: SupabaseResult<ApplicationQuestionRow> = await db
    .from("application_questions")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function deleteApplicationQuestion(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("application_questions").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

// ============================================================
// Application Required Documents
// ============================================================

export async function listApplicationRequiredDocuments(applicationId: string): Promise<ApplicationRequiredDocumentRow[]> {
  const result: SupabaseResult<ApplicationRequiredDocumentRow[]> = await db
    .from("application_required_documents")
    .select("*")
    .eq("application_id", applicationId)
    .order("sort_order", { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createApplicationRequiredDocument(
  input: Omit<ApplicationRequiredDocumentInsert, "id" | "created_at" | "updated_at">
): Promise<ApplicationRequiredDocumentRow> {
  const result: SupabaseResult<ApplicationRequiredDocumentRow> = await db
    .from("application_required_documents")
    .insert(input)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateApplicationRequiredDocument(
  id: string,
  updates: Omit<ApplicationRequiredDocumentUpdate, "id" | "created_at">
): Promise<ApplicationRequiredDocumentRow> {
  const result: SupabaseResult<ApplicationRequiredDocumentRow> = await db
    .from("application_required_documents")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function deleteApplicationRequiredDocument(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("application_required_documents").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}
