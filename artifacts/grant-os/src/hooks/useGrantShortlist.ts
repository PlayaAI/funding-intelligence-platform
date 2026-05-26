import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveGrantShortlistItem,
  listGrantShortlistItems,
  upsertGrantShortlistItem,
  type GrantShortlistItemInsert,
  type GrantShortlistItemRow,
} from "@/lib/grantShortlistService";

export type { GrantShortlistItemInsert, GrantShortlistItemRow };

export const GRANT_SHORTLIST_QUERY_KEY = ["grant_shortlist_items"] as const;

export function useGrantShortlistItems() {
  return useQuery({
    queryKey: GRANT_SHORTLIST_QUERY_KEY,
    queryFn: listGrantShortlistItems,
    staleTime: 1000 * 60,
  });
}

export function useUpsertGrantShortlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertGrantShortlistItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: GRANT_SHORTLIST_QUERY_KEY }),
  });
}

export function useArchiveGrantShortlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveGrantShortlistItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: GRANT_SHORTLIST_QUERY_KEY }),
  });
}
