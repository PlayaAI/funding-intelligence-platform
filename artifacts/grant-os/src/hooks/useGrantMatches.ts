import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dismissMatch,
  generateMatchesForAllProjects,
  generateMatchesForGrant,
  generateMatchesForProject,
  hideMatch,
  listMatches,
  listMatchesForGrant,
  listMatchesForProject,
  markReviewed,
  refreshMatch,
  saveMatch,
  type MatchFilters,
} from "@/lib/matching/matchesService";

export const GRANT_MATCHES_QUERY_KEY = ["grant_matches"] as const;

export function useGrantMatches(filters?: MatchFilters) {
  return useQuery({
    queryKey: [...GRANT_MATCHES_QUERY_KEY, filters ?? {}],
    queryFn: () => listMatches(filters),
    staleTime: 1000 * 30,
  });
}

export function useGrantMatchesForProject(projectId: string | undefined) {
  return useQuery({
    queryKey: [...GRANT_MATCHES_QUERY_KEY, "project", projectId],
    queryFn: () => listMatchesForProject(projectId!),
    enabled: Boolean(projectId),
    staleTime: 1000 * 30,
  });
}

export function useGrantMatchesForGrant(grantId: string | undefined) {
  return useQuery({
    queryKey: [...GRANT_MATCHES_QUERY_KEY, "grant", grantId],
    queryFn: () => listMatchesForGrant(grantId!),
    enabled: Boolean(grantId),
    staleTime: 1000 * 30,
  });
}

function useInvalidateMatches() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: GRANT_MATCHES_QUERY_KEY });
}

export function useGenerateMatchesForProject() {
  const invalidate = useInvalidateMatches();
  return useMutation({ mutationFn: generateMatchesForProject, onSuccess: invalidate });
}

export function useGenerateMatchesForGrant() {
  const invalidate = useInvalidateMatches();
  return useMutation({ mutationFn: generateMatchesForGrant, onSuccess: invalidate });
}

export function useGenerateMatchesForAllProjects() {
  const invalidate = useInvalidateMatches();
  return useMutation({ mutationFn: generateMatchesForAllProjects, onSuccess: invalidate });
}

export function useRefreshMatch() {
  const invalidate = useInvalidateMatches();
  return useMutation({ mutationFn: refreshMatch, onSuccess: invalidate });
}

export function useSaveMatch() {
  const invalidate = useInvalidateMatches();
  return useMutation({ mutationFn: saveMatch, onSuccess: invalidate });
}

export function useHideMatch() {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => hideMatch(id, reason),
    onSuccess: invalidate,
  });
}

export function useDismissMatch() {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => dismissMatch(id, reason),
    onSuccess: invalidate,
  });
}

export function useMarkReviewed() {
  const invalidate = useInvalidateMatches();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId?: string | null }) => markReviewed(id, userId),
    onSuccess: invalidate,
  });
}
