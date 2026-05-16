import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mapGrantRow, mapGrantRows } from "@/lib/grantMappers";
import { useProjects } from "@/hooks/useProjects";
import {
  listGrants,
  getGrantById,
  createGrant,
  updateGrant,
  archiveGrant,
  deleteGrant,
  setGrantTopThree,
  type GrantRow,
  type GrantInsert,
  type GrantUpdate,
  type ListGrantsOptions,
} from "@/lib/grantsService";

export type { GrantRow, GrantInsert, GrantUpdate, ListGrantsOptions };

export const GRANTS_QUERY_KEY = ["grants"] as const;

export function useGrants(opts?: ListGrantsOptions) {
  return useQuery({
    queryKey: opts?.includeSoftArchived
      ? [...GRANTS_QUERY_KEY, "includeSoftArchived"]
      : GRANTS_QUERY_KEY,
    queryFn: () => listGrants(opts),
    staleTime: 1000 * 60,
  });
}

export function useGrant(id: string | undefined) {
  return useQuery({
    queryKey: [...GRANTS_QUERY_KEY, id],
    queryFn: () => getGrantById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 60,
  });
}

export function useCreateGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<GrantInsert, "id" | "created_at" | "updated_at">) =>
      createGrant(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
    },
  });
}

export function useUpdateGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Omit<GrantUpdate, "id" | "created_at">;
    }) => updateGrant(id, updates),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...GRANTS_QUERY_KEY, id] });
    },
  });
}

export function useArchiveGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveGrant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
    },
  });
}

export function useDeleteGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGrant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
    },
  });
}

export function useSetGrantTopThree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isTopThree }: { id: string; isTopThree: boolean }) =>
      setGrantTopThree(id, isTopThree),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...GRANTS_QUERY_KEY, id] });
    },
  });
}

/** Grants from Supabase mapped to dashboard UI shape, with project names/colors. */
export function useMappedGrants(opts?: ListGrantsOptions) {
  const grantsQuery = useGrants(opts);
  const projectsQuery = useProjects();

  const grants = useMemo(() => {
    if (!grantsQuery.data) return [];
    return mapGrantRows(grantsQuery.data, projectsQuery.data ?? []);
  }, [grantsQuery.data, projectsQuery.data]);

  return {
    grants,
    projects: projectsQuery.data ?? [],
    isLoading: grantsQuery.isLoading || projectsQuery.isLoading,
    isError: grantsQuery.isError || projectsQuery.isError,
    error: grantsQuery.error ?? projectsQuery.error,
    refetch: grantsQuery.refetch,
  };
}

export function useMappedGrant(id: string | undefined) {
  const grantQuery = useGrant(id);
  const projectsQuery = useProjects();

  const grant = useMemo(() => {
    if (!grantQuery.data) return null;
    const byId = new Map((projectsQuery.data ?? []).map((p) => [p.id, p]));
    return mapGrantRow(grantQuery.data, byId);
  }, [grantQuery.data, projectsQuery.data]);

  return {
    grant,
    grantRow: grantQuery.data ?? null,
    isLoading: grantQuery.isLoading || projectsQuery.isLoading,
    isError: grantQuery.isError || projectsQuery.isError,
    error: grantQuery.error ?? projectsQuery.error,
  };
}
