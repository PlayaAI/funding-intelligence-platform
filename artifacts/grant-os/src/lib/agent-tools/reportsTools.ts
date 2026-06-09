import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import {
  buildApplicationWorkloadReport,
  buildDashboardSummary,
  buildDataQualityReport,
  buildDeadlineReport,
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
      description: "Return grants grouped by deadline windows.",
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
  ];
}
