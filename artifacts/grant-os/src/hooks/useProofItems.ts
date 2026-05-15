import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProofItems,
  getProofItem,
  createProofItem,
  updateProofItem,
  archiveProofItem,
  deleteProofItem,
  type ProofItemRow,
  type ProofItemInsert,
  type ProofItemUpdate,
} from "@/lib/proofItemsService";

export type { ProofItemRow, ProofItemInsert, ProofItemUpdate };

export const PROOF_ITEMS_QUERY_KEY = ["proof_items"] as const;

export function useProofItems(
  projectId?: string,
  opts?: { requireProjectId?: boolean }
) {
  return useQuery({
    queryKey: projectId
      ? [...PROOF_ITEMS_QUERY_KEY, { projectId }]
      : PROOF_ITEMS_QUERY_KEY,
    queryFn: () => listProofItems(projectId),
    // If requireProjectId is true, don't fire until we have a real ID.
    enabled: opts?.requireProjectId ? Boolean(projectId) : true,
    staleTime: 1000 * 60,
  });
}

export function useProofItem(id: string | undefined) {
  return useQuery({
    queryKey: [...PROOF_ITEMS_QUERY_KEY, id],
    queryFn: () => getProofItem(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useCreateProofItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ProofItemInsert, "id" | "created_at" | "updated_at">) =>
      createProofItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROOF_ITEMS_QUERY_KEY }),
  });
}

export function useUpdateProofItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Omit<ProofItemUpdate, "id" | "created_at">;
    }) => updateProofItem(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: PROOF_ITEMS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...PROOF_ITEMS_QUERY_KEY, id] });
    },
  });
}

export function useArchiveProofItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveProofItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROOF_ITEMS_QUERY_KEY }),
  });
}

export function useDeleteProofItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProofItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROOF_ITEMS_QUERY_KEY }),
  });
}
