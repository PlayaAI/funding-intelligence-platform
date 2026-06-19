import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProjects,
  getProjectBySlug,
  createProject,
  updateProject,
  archiveProject,
  deleteProject,
  type ProjectRow,
  type ProjectInsert,
  type ProjectUpdate,
} from "@/lib/projectsService";

export type { ProjectRow, ProjectInsert, ProjectUpdate };

export const PROJECT_QUERY_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECT_QUERY_KEY,
    queryFn: () => listProjects(),
    staleTime: 1000 * 60,
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: [...PROJECT_QUERY_KEY, slug],
    queryFn: () => getProjectBySlug(slug!),
    enabled: Boolean(slug),
    staleTime: 1000 * 60,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ProjectInsert, "id" | "created_at" | "updated_at">) =>
      createProject(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_QUERY_KEY }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      updates,
    }: {
      slug: string;
      updates: Omit<ProjectUpdate, "id" | "slug" | "created_at">;
    }) => updateProject(slug, updates),
    onSuccess: (_data, { slug }) => {
      qc.invalidateQueries({ queryKey: PROJECT_QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...PROJECT_QUERY_KEY, slug] });
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => archiveProject(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_QUERY_KEY }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECT_QUERY_KEY }),
  });
}
