import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import {
  buildApplicationWorkloadReport,
  buildDashboardSummary,
  buildDataQualityReport,
  buildDeadlineReport,
  buildAgentContextBrief,
} from "./builders";

export function createReportTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "get_dashboard_summary",
      description: "Return a high-level dashboard summary for internal operations.",
      permissionLevel: "read",
      inputSchema: z.object({}),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Aggregate metrics still reflect internal operational state."],
      relatedTables: ["grants", "applications", "tasks", "projects", "documents", "peer_organizations", "peer_funding_records"],
      touchesRealDb: true,
      execute: () => buildDashboardSummary(repository),
    },
    {
      name: "get_deadline_report",
      description: "Return all grants grouped by deadline windows (7, 14, 30, 60+ days). HIGH COST — reads the full grants table. Do NOT use for narrow grant-ranking or fit questions. For narrow tasks (e.g. 'which grant should we apply for first?'), prefer get_grant_decision_brief or list_grant_matches instead. Use this only when the user explicitly asks for a full deadline overview.",
      permissionLevel: "read",
      inputSchema: z.object({}),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Deadline reports may drive sensitive prioritization decisions."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      execute: () => buildDeadlineReport(repository),
    },
    {
      name: "get_application_workload_report",
      description: "Return per-application workload metrics.",
      permissionLevel: "read",
      inputSchema: z.object({}),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Workload reporting reveals internal capacity and gaps."],
      relatedTables: ["applications", "tasks", "documents", "application_questions", "application_required_documents"],
      touchesRealDb: true,
      execute: () => buildApplicationWorkloadReport(repository),
    },
    {
      name: "get_data_quality_report",
      description: "Identify records missing deadlines, URLs, ownership, or project linkage.",
      permissionLevel: "read",
      inputSchema: z.object({}),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Data-quality reports expose operational weaknesses and should stay internal."],
      relatedTables: ["grants", "applications", "tasks", "documents"],
      touchesRealDb: true,
      execute: () => buildDataQualityReport(repository),
    },
    {
      name: "get_agent_context_brief",
      description: "Return a lightweight workspace context snapshot for agent startup — grant/application counts, upcoming deadlines, and top knowledge items. LOW COST. Use this as the first call when orienting to the workspace. Do not use get_deadline_report or broad list calls for orientation.",
      permissionLevel: "read",
      inputSchema: z.object({}),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Minimal context exposes high-level counts and titles."],
      relatedTables: ["grants", "applications", "tasks", "agent_knowledge"],
      touchesRealDb: true,
      execute: () => buildAgentContextBrief(repository),
    },
  ];
}
