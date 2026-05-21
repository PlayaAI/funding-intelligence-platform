import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveAgentReport,
  createAgentReport,
  listAgentReports,
  updateAgentReport,
  type AgentReportFilters,
  type AgentReportInsert,
  type AgentReportRow,
  type AgentReportUpdate,
} from "@/lib/agentReportsService";

export type { AgentReportFilters, AgentReportInsert, AgentReportRow, AgentReportUpdate };

export const AGENT_REPORTS_QUERY_KEY = ["agent_reports"] as const;

export function useAgentReports(filters?: AgentReportFilters) {
  return useQuery({
    queryKey: [
      ...AGENT_REPORTS_QUERY_KEY,
      filters?.relatedProjectId ?? null,
      filters?.relatedGrantId ?? null,
      filters?.relatedApplicationId ?? null,
      filters?.includeArchived ?? false,
    ],
    queryFn: () => listAgentReports(filters),
    staleTime: 1000 * 60,
  });
}

export function useCreateAgentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AgentReportInsert, "id" | "created_at" | "updated_at">) => createAgentReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_REPORTS_QUERY_KEY }),
  });
}

export function useUpdateAgentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<AgentReportUpdate, "id" | "created_at"> }) =>
      updateAgentReport(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_REPORTS_QUERY_KEY }),
  });
}

export function useArchiveAgentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveAgentReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENT_REPORTS_QUERY_KEY }),
  });
}
