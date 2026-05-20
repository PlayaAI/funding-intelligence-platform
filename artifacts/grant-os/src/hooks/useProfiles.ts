import { useQuery } from "@tanstack/react-query";
import { listProfiles, type ProfileRow } from "@/lib/profilesService";

export type { ProfileRow };

export const PROFILES_QUERY_KEY = ["profiles"] as const;

export function useProfiles() {
  return useQuery({
    queryKey: PROFILES_QUERY_KEY,
    queryFn: listProfiles,
    staleTime: 1000 * 60,
  });
}
