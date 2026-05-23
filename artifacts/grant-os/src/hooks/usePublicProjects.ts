import { useQuery } from "@tanstack/react-query";
import { getPublicProjectBySlug, listPublicProjects } from "@/lib/public/publicDataService";

export const PUBLIC_PROJECTS_QUERY_KEY = ["public_projects"] as const;

export function usePublicProjects() {
  return useQuery({
    queryKey: PUBLIC_PROJECTS_QUERY_KEY,
    queryFn: listPublicProjects,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function usePublicProject(slug: string | undefined) {
  return useQuery({
    queryKey: [...PUBLIC_PROJECTS_QUERY_KEY, slug],
    queryFn: () => getPublicProjectBySlug(slug!),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
