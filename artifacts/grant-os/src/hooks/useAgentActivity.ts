import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAgentActivity,
  listAgentActivity,
  type AgentActivityLogInsert,
  type AgentActivityLogRow,
} from "@/lib/agentActivityService";

export type { AgentActivityLogInsert, AgentActivityLogRow };

export const AGENT_ACTIVITY_QUERY_KEY = ["agent_activity_logs"] as const;

export function useAgentActivity(limit = 100) {
  return useQuery({
    queryKey: [...AGENT_ACTIVITY_QUERY_KEY, limit],
    queryFn: () => listAgentActivity(limit),
    staleTime: 1000 * 60,
  });
}

export function useCreateAgentActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AgentActivityLogInsert, "id" | "created_at">) => createAgentActivity(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_ACTIVITY_QUERY_KEY }),
  });
}
