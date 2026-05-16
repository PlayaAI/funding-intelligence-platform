import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listApplications,
  getApplicationById,
  listApplicationsByGrant,
  listApplicationsByProject,
  createApplication,
  updateApplication,
  archiveApplication,
  deleteApplication,
  listApplicationQuestions,
  createApplicationQuestion,
  updateApplicationQuestion,
  deleteApplicationQuestion,
  listApplicationRequiredDocuments,
  createApplicationRequiredDocument,
  updateApplicationRequiredDocument,
  deleteApplicationRequiredDocument,
  type ApplicationRow,
  type ApplicationInsert,
  type ApplicationUpdate,
  type ApplicationQuestionRow,
  type ApplicationQuestionInsert,
  type ApplicationQuestionUpdate,
  type ApplicationRequiredDocumentRow,
  type ApplicationRequiredDocumentInsert,
  type ApplicationRequiredDocumentUpdate,
  type ListApplicationsOptions,
} from "@/lib/applicationsService";

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
  ListApplicationsOptions,
};

export const APPLICATIONS_QUERY_KEY = ["applications"] as const;
export const APP_QUESTIONS_QUERY_KEY = ["application_questions"] as const;
export const APP_REQ_DOCS_QUERY_KEY = ["application_required_documents"] as const;

// ============================================================
// Applications
// ============================================================

export function useApplications(opts?: ListApplicationsOptions) {
  return useQuery({
    queryKey: opts?.includeSoftArchived
      ? [...APPLICATIONS_QUERY_KEY, "includeSoftArchived"]
      : APPLICATIONS_QUERY_KEY,
    queryFn: () => listApplications(opts),
    staleTime: 1000 * 60,
  });
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: [...APPLICATIONS_QUERY_KEY, id],
    queryFn: () => getApplicationById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useApplicationsByGrant(grantId: string | undefined) {
  return useQuery({
    queryKey: [...APPLICATIONS_QUERY_KEY, "byGrant", grantId],
    queryFn: () => listApplicationsByGrant(grantId!),
    enabled: Boolean(grantId),
    staleTime: 1000 * 60,
  });
}

export function useApplicationsByProject(projectId: string | undefined) {
  return useQuery({
    queryKey: [...APPLICATIONS_QUERY_KEY, "byProject", projectId],
    queryFn: () => listApplicationsByProject(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 60,
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ApplicationInsert, "id" | "created_at" | "updated_at">) =>
      createApplication(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
    },
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<ApplicationUpdate, "id" | "created_at"> }) =>
      updateApplication(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...APPLICATIONS_QUERY_KEY, id] });
    },
  });
}

export function useArchiveApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApplication(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY });
    },
  });
}

// ============================================================
// Application Questions
// ============================================================

export function useApplicationQuestions(applicationId: string | undefined) {
  return useQuery({
    queryKey: [...APP_QUESTIONS_QUERY_KEY, applicationId],
    queryFn: () => listApplicationQuestions(applicationId!),
    enabled: Boolean(applicationId),
    staleTime: 1000 * 60,
  });
}

export function useCreateApplicationQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ApplicationQuestionInsert, "id" | "created_at" | "updated_at">) =>
      createApplicationQuestion(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: [...APP_QUESTIONS_QUERY_KEY, input.application_id] });
    },
  });
}

export function useUpdateApplicationQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      applicationId,
      updates,
    }: {
      id: string;
      applicationId: string;
      updates: Omit<ApplicationQuestionUpdate, "id" | "created_at">;
    }) => updateApplicationQuestion(id, updates),
    onSuccess: (_data, { applicationId }) => {
      qc.invalidateQueries({ queryKey: [...APP_QUESTIONS_QUERY_KEY, applicationId] });
    },
  });
}

export function useDeleteApplicationQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: string; applicationId: string }) =>
      deleteApplicationQuestion(id),
    onSuccess: (_data, { applicationId }) => {
      qc.invalidateQueries({ queryKey: [...APP_QUESTIONS_QUERY_KEY, applicationId] });
    },
  });
}

// ============================================================
// Application Required Documents
// ============================================================

export function useApplicationRequiredDocuments(applicationId: string | undefined) {
  return useQuery({
    queryKey: [...APP_REQ_DOCS_QUERY_KEY, applicationId],
    queryFn: () => listApplicationRequiredDocuments(applicationId!),
    enabled: Boolean(applicationId),
    staleTime: 1000 * 60,
  });
}

export function useCreateApplicationRequiredDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ApplicationRequiredDocumentInsert, "id" | "created_at" | "updated_at">) =>
      createApplicationRequiredDocument(input),
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: [...APP_REQ_DOCS_QUERY_KEY, input.application_id] });
    },
  });
}

export function useUpdateApplicationRequiredDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      applicationId,
      updates,
    }: {
      id: string;
      applicationId: string;
      updates: Omit<ApplicationRequiredDocumentUpdate, "id" | "created_at">;
    }) => updateApplicationRequiredDocument(id, updates),
    onSuccess: (_data, { applicationId }) => {
      qc.invalidateQueries({ queryKey: [...APP_REQ_DOCS_QUERY_KEY, applicationId] });
    },
  });
}

export function useDeleteApplicationRequiredDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: string; applicationId: string }) =>
      deleteApplicationRequiredDocument(id),
    onSuccess: (_data, { applicationId }) => {
      qc.invalidateQueries({ queryKey: [...APP_REQ_DOCS_QUERY_KEY, applicationId] });
    },
  });
}
