import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveAgentNote,
  createAgentNote,
  deleteAgentNote,
  listAgentNotes,
  updateAgentNote,
  type AgentNoteFilters,
  type AgentNoteInsert,
  type AgentNoteRow,
  type AgentNoteUpdate,
} from "@/lib/agentNotesService";

export type { AgentNoteFilters, AgentNoteInsert, AgentNoteRow, AgentNoteUpdate };

export const AGENT_NOTES_QUERY_KEY = ["agent_notes"] as const;

export function useAgentNotes(filters?: AgentNoteFilters) {
  return useQuery({
    queryKey: [
      ...AGENT_NOTES_QUERY_KEY,
      filters?.relatedProjectId ?? null,
      filters?.relatedGrantId ?? null,
      filters?.relatedFunderId ?? null,
      filters?.relatedApplicationId ?? null,
      filters?.includeArchived ?? false,
    ],
    queryFn: () => listAgentNotes(filters),
    staleTime: 1000 * 60,
  });
}

export function useCreateAgentNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AgentNoteInsert, "id" | "created_at" | "updated_at">) => createAgentNote(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_NOTES_QUERY_KEY }),
  });
}

export function useUpdateAgentNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<AgentNoteUpdate, "id" | "created_at"> }) =>
      updateAgentNote(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_NOTES_QUERY_KEY }),
  });
}

export function useArchiveAgentNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveAgentNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_NOTES_QUERY_KEY }),
  });
}

export function useDeleteAgentNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAgentNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_NOTES_QUERY_KEY }),
  });
}
