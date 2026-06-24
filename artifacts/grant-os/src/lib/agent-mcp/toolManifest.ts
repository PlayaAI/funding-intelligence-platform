import type { ToolMetadata } from "../agent-tools/types";
import type { JsonRecord, McpToolManifestEntry } from "./types";

export const MCP_BLOCKED_TOOL_NAMES = new Set<string>([
  "archive_record",
  "delete_record",
  "bulk_update_records",
  "send_outreach",
  "submit_application_externally",
  "run_import_job",
  "run_scraping_job",
  "mutate_public_website_content",
  "change_access_policies",
]);

export const MCP_ENABLED_TOOL_NAMES = new Set<string>([
  "list_grants",
  "search_grants",
  "get_grant",
  "export_grant_packet",
  "list_funders",
  "get_funder",
  "get_funder_grants",
  "get_funder_peer_intelligence",
  "list_documents",
  "get_document",
  "get_documents_for_grant",
  "get_documents_for_application",
  "list_projects",
  "get_project",
  "list_proof_items",
  "list_applications",
  "get_application",
  "export_application_packet",
  "list_tasks",
  "get_task",
  "list_peers",
  "get_peer",
  "get_peer_funding_records",
  "export_peer_packet",
  "get_dashboard_summary",
  "get_deadline_report",
  "get_application_workload_report",
  "get_data_quality_report",
  "create_application_from_grant",
  "generate_application_checklist",
  "create_task",
  "update_task_status",
  "add_application_note",
  "add_peer_organization",
  "add_peer_funding_record",
  "mark_grant_status",
  "save_grant_to_shortlist",
  "list_grant_matches",
  "get_grant_match",
  "generate_grant_match",
  "save_agent_match",
  "generate_application_readiness_report",
  "get_agent_context_brief",
]);

const TOOL_DETAILS: Record<string, { schemaSummary: string; exampleInput?: JsonRecord }> = {
  // Grants
  list_grants: { schemaSummary: "{ status?: string, funderId?: string, limit?: number }", exampleInput: {} },
  search_grants: { schemaSummary: "{ query: string }", exampleInput: { query: "Humanity AI" } },
  get_grant: { schemaSummary: "{ grantId: string }", exampleInput: { grantId: "grant-1" } },
  export_grant_packet: { schemaSummary: "{ grantId: string, compact?: boolean (default true) }", exampleInput: { grantId: "grant-1" } },
  // Funders
  list_funders: { schemaSummary: "{ limit?: number (default 25, max 100) }", exampleInput: {} },
  get_funder: { schemaSummary: "{ funderId: string }", exampleInput: { funderId: "funder-1" } },
  get_funder_grants: { schemaSummary: "{ funderId: string }", exampleInput: { funderId: "funder-1" } },
  get_funder_peer_intelligence: { schemaSummary: "{ funderId: string }", exampleInput: { funderId: "funder-1" } },
  // Documents
  list_documents: { schemaSummary: "{ relatedGrantId?: string, relatedApplicationId?: string, relatedProjectId?: string, includeExtractedText?: boolean }", exampleInput: {} },
  get_document: { schemaSummary: "{ documentId: string, includeExtractedText?: boolean (default false) }", exampleInput: { documentId: "doc-1" } },
  get_documents_for_grant: { schemaSummary: "{ grantId: string, includeExtractedText?: boolean }", exampleInput: { grantId: "grant-1" } },
  get_documents_for_application: { schemaSummary: "{ applicationId: string, includeExtractedText?: boolean }", exampleInput: { applicationId: "app-1" } },
  // Projects & proof
  list_projects: { schemaSummary: "{ limit?: number (default 25, max 200) }", exampleInput: {} },
  get_project: { schemaSummary: "{ projectId: string }", exampleInput: { projectId: "project-1" } },
  list_proof_items: { schemaSummary: "{ projectId?: string, limit?: number (default 50, max 200) }", exampleInput: { projectId: "project-1" } },
  get_proof_items_for_project: { schemaSummary: "{ projectId: string }", exampleInput: { projectId: "project-1" } },
  // Applications
  list_applications: { schemaSummary: "{ limit?: number, grantId?: string }", exampleInput: {} },
  get_application: { schemaSummary: "{ applicationId: string }", exampleInput: { applicationId: "app-1" } },
  export_application_packet: { schemaSummary: "{ applicationId: string, compact?: boolean (default true) }", exampleInput: { applicationId: "app-1" } },
  // Tasks
  list_tasks: { schemaSummary: "{ relatedGrantId?: string, relatedApplicationId?: string, status?: string, limit?: number }", exampleInput: {} },
  get_task: { schemaSummary: "{ taskId: string }", exampleInput: { taskId: "task-1" } },
  // Peers
  list_peers: { schemaSummary: "{ limit?: number (default 25, max 100) }", exampleInput: {} },
  get_peer: { schemaSummary: "{ peerId: string }", exampleInput: { peerId: "peer-1" } },
  get_peer_funding_records: { schemaSummary: "{ peerId: string }", exampleInput: { peerId: "peer-1" } },
  export_peer_packet: { schemaSummary: "{ peerId: string, compact?: boolean (default true) }", exampleInput: { peerId: "peer-1" } },
  // Reports
  get_dashboard_summary: { schemaSummary: "{}", exampleInput: {} },
  get_deadline_report: { schemaSummary: "{}", exampleInput: {} },
  get_application_workload_report: { schemaSummary: "{}", exampleInput: {} },
  get_data_quality_report: { schemaSummary: "{}", exampleInput: {} },
  get_agent_context_brief: { schemaSummary: "{}", exampleInput: {} },
  // Mutations (write_safe, all default dryRun: true)
  create_application_from_grant: { schemaSummary: "{ grantId: string, projectId: string, dryRun?: boolean }", exampleInput: { grantId: "grant-1", projectId: "project-1", dryRun: true } },
  generate_application_checklist: { schemaSummary: "{ applicationId: string, dryRun?: boolean }", exampleInput: { applicationId: "app-1", dryRun: true } },
  create_task: { schemaSummary: "{ title: string, dryRun?: boolean, relatedGrantId?: string, relatedApplicationId?: string }", exampleInput: { title: "Draft narrative outline", dryRun: true } },
  update_task_status: { schemaSummary: "{ taskId: string, status: string, dryRun?: boolean }", exampleInput: { taskId: "task-1", status: "Needs Review", dryRun: true } },
  add_application_note: { schemaSummary: "{ applicationId: string, title: string, content: string, dryRun?: boolean }", exampleInput: { applicationId: "app-1", title: "Narrative note", content: "Need budget backup.", dryRun: true } },
  add_peer_organization: { schemaSummary: "{ name: string, dryRun?: boolean }", exampleInput: { name: "Example Peer", dryRun: true } },
  add_peer_funding_record: { schemaSummary: "{ peerOrganizationId: string, funderName: string, year?: number, dryRun?: boolean }", exampleInput: { peerOrganizationId: "peer-1", funderName: "MIT Solve", year: 2025, dryRun: true } },
  mark_grant_status: { schemaSummary: "{ grantId: string, status: string, dryRun?: boolean }", exampleInput: { grantId: "grant-1", status: "Applying", dryRun: true } },
  save_grant_to_shortlist: { schemaSummary: "{ grantId: string, projectId?: string, status?: string, dryRun?: boolean }", exampleInput: { grantId: "grant-1", projectId: "project-1", dryRun: true } },
  // Grant matches
  list_grant_matches: { schemaSummary: "{ grantId?: string, projectId?: string, limit?: number (default 20) }" },
  get_grant_match: { schemaSummary: "{ matchId: string }", exampleInput: { matchId: "match-1" } },
  generate_grant_match: { schemaSummary: "{ grantId: string, projectId: string, dryRun?: boolean }", exampleInput: { grantId: "grant-1", projectId: "project-1", dryRun: true } },
  save_agent_match: { schemaSummary: "{ grantId, projectId, fitScore 1-10, urgencyScore 1-10, effortScore 1-10, strategicValueScore 1-10, recommendation, summary, whyItFits, whyItMightNotFit, bestProjectAngle, strongestApplicationStory, risks[], missingInfo[], evidenceNeeded[], recommendedNextStep, dryRun? }" },
  generate_application_readiness_report: { schemaSummary: "{ grantId: string, projectId: string }" },
  // Knowledge
  list_agent_knowledge_items: { schemaSummary: "{ knowledge_type?: string, category?: string, priority?: string, limit?: number (default 25), includeContent?: boolean }", exampleInput: {} },
  get_agent_knowledge_item: { schemaSummary: "{ item_id: string }", exampleInput: { item_id: "item-1" } },
  list_agent_knowledge_proposals: { schemaSummary: "{ status?: string, limit?: number (default 25), includeContent?: boolean }", exampleInput: {} },
  propose_agent_knowledge_update: { schemaSummary: "{ proposal_type, title, category, proposed_content, rationale?, risk_level?, dryRun? }", exampleInput: { proposal_type: "add", title: "New rule", category: "Test", proposed_content: "Always do X.", dryRun: true } },
};

export function buildMcpToolManifest(tools: ToolMetadata[]): McpToolManifestEntry[] {
  return tools
    .filter((tool) => MCP_ENABLED_TOOL_NAMES.has(tool.name))
    .map((tool) => {
      const details = TOOL_DETAILS[tool.name] ?? { schemaSummary: "{}" };
      return {
        name: tool.name,
        description: tool.description,
        permissionLevel: tool.permissionLevel,
        enabled: true,
        defaultDryRun: tool.permissionLevel === "write_safe" && tool.dryRunSupported ? true : undefined,
        schemaSummary: details.schemaSummary,
        // exampleInput intentionally omitted from live manifest to reduce per-session token cost
      };
    });
}
