import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveDocument,
  createDocument,
  deleteDocument,
  extractDocumentText,
  getDocument,
  getDocumentSignedUrl,
  listGrantDocuments,
  listDocuments,
  updateDocument,
  uploadDocumentFile,
  type DocumentFilters,
  type DocumentInsert,
  type DocumentRow,
  type DocumentUpdate,
  type GrantDocumentLookup,
} from "@/lib/documentsService";

export type { DocumentFilters, DocumentInsert, DocumentRow, DocumentUpdate, GrantDocumentLookup };

export const DOCUMENTS_QUERY_KEY = ["documents"] as const;

export function useDocuments(filters?: DocumentFilters) {
  return useQuery({
    queryKey: [DOCUMENTS_QUERY_KEY, filters],
    queryFn: () => listDocuments(filters),
    staleTime: 1000 * 60,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: [...DOCUMENTS_QUERY_KEY, id],
    queryFn: () => getDocument(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useGrantDocuments(input: GrantDocumentLookup | null | undefined) {
  return useQuery({
    queryKey: [...DOCUMENTS_QUERY_KEY, "grant-intelligence", input],
    queryFn: () => listGrantDocuments(input!),
    enabled: Boolean(input?.grantId),
    staleTime: 1000 * 60,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DocumentInsert, "id" | "created_at" | "updated_at">) => createDocument(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

export function useUploadDocumentFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata: Parameters<typeof uploadDocumentFile>[1] }) => uploadDocumentFile(file, metadata),
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<DocumentUpdate, "id" | "created_at"> }) => updateDocument(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...DOCUMENTS_QUERY_KEY, id] });
    },
  });
}

export function useArchiveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
  });
}

export function useExtractDocumentText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => extractDocumentText(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...DOCUMENTS_QUERY_KEY, id] });
    },
  });
}

export function useDocumentSignedUrl(doc: DocumentRow | null | undefined) {
  return useQuery({
    queryKey: [...DOCUMENTS_QUERY_KEY, "signedUrl", doc?.id, doc?.file_path, doc?.source_url],
    queryFn: () => getDocumentSignedUrl(doc!),
    enabled: Boolean(doc && (doc.file_path || doc.file_url || doc.source_url)),
    staleTime: 1000 * 60 * 10,
  });
}
