import { useQuery } from "@tanstack/react-query";
import { listPublicProofItems } from "@/lib/public/publicDataService";

export const PUBLIC_PROOF_ITEMS_QUERY_KEY = ["public_proof_items"] as const;

export function usePublicProofItems(projectId?: string, opts?: { requireProjectId?: boolean }) {
  return useQuery({
    queryKey: projectId ? [...PUBLIC_PROOF_ITEMS_QUERY_KEY, projectId] : PUBLIC_PROOF_ITEMS_QUERY_KEY,
    queryFn: () => listPublicProofItems(projectId),
    enabled: opts?.requireProjectId ? Boolean(projectId) : true,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
