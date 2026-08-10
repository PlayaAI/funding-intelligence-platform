import type { AgentTokenScope } from "./agentTokenService";

export const AUTONOMOUS_TOOL_NAMES = new Set([
  "create_grant",
  "upsert_grant_from_source",
  "bulk_upsert_grants_from_sources",
  "refresh_grant_from_source",
  "run_autonomous_grant_ops_cycle",
  "run_grant_discovery_cycle",
  "archive_grant",
  "batch_archive_expired_grants",
  "mark_grant_status",
  "update_grant_status",
  "set_top_three_grant",
  "remove_top_three_grant",
  "update_grant_priority_fields",
  "create_application_from_grant",
  "update_application_status",
  "add_application_note",
  "generate_application_checklist",
  "bulk_create_tasks_from_checklist",
  "create_task",
  "update_task_status",
  "update_task_due_date",
  "propose_agent_knowledge_update",
]);

export type AgentAutonomyPolicyRecord = {
  id: string;
  token_id: string;
  user_id: string;
  enabled: boolean;
  allowed_tools: string[];
  daily_write_limit: number;
  max_batch_size: number;
  minimum_fit_score: number;
  minimum_deadline_days: number;
  require_primary_source: boolean;
  allow_internal_applications: boolean;
  allow_task_management: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentAutonomyUsage = {
  writesToday: number;
};

export type AgentAutonomyEvent = {
  tokenId: string;
  userId: string;
  policyId: string;
  toolName: string;
  idempotencyKey: string;
  mutationPerformed: boolean;
  affectedRecordIds: string[];
  resultSummary: Record<string, unknown>;
  errorCode?: string | null;
};

export type AgentAutonomyExecutionClaim =
  | { ok: true; eventId: string }
  | { ok: false; code: "replay_detected" | "autonomy_audit_unavailable"; message: string };

export type AgentAutonomyStore = {
  resolvePolicy(tokenId: string): Promise<AgentAutonomyPolicyRecord | null>;
  getUsage(tokenId: string): Promise<AgentAutonomyUsage>;
  claimExecution(input: Omit<AgentAutonomyEvent, "mutationPerformed" | "affectedRecordIds" | "resultSummary" | "errorCode">): Promise<AgentAutonomyExecutionClaim>;
  completeExecution(eventId: string, input: Pick<AgentAutonomyEvent, "mutationPerformed" | "affectedRecordIds" | "resultSummary" | "errorCode">): Promise<void>;
};

const SCOPE_TO_TOOLS: Partial<Record<AgentTokenScope, string[]>> = {
  "mcp:grants:create": ["create_grant", "upsert_grant_from_source", "bulk_upsert_grants_from_sources", "refresh_grant_from_source"],
  "mcp:discovery:run": ["run_autonomous_grant_ops_cycle", "run_grant_discovery_cycle"],
  "mcp:grants:archive": ["archive_grant", "batch_archive_expired_grants"],
  "mcp:grants:update_status": ["mark_grant_status", "update_grant_status", "update_grant_priority_fields"],
  "mcp:grants:top_three": ["set_top_three_grant", "remove_top_three_grant"],
  "mcp:applications:create": ["create_application_from_grant"],
  "mcp:applications:update": ["update_application_status", "add_application_note"],
  "mcp:tasks:create": ["generate_application_checklist", "bulk_create_tasks_from_checklist", "create_task", "run_autonomous_grant_ops_cycle"],
  "mcp:tasks:update": ["update_task_status", "update_task_due_date"],
  "mcp:knowledge:propose": ["propose_agent_knowledge_update"],
};

export function defaultAllowedAutonomyTools(scopes: string[]): string[] {
  const tools = new Set<string>();
  for (const scope of scopes) {
    for (const tool of SCOPE_TO_TOOLS[scope as AgentTokenScope] ?? []) tools.add(tool);
  }
  return [...tools].filter((tool) => AUTONOMOUS_TOOL_NAMES.has(tool)).sort();
}

function requestedBatchSize(input: Record<string, unknown>): number {
  if (Array.isArray(input.candidates)) return input.candidates.length;
  if (Array.isArray(input.grantIds)) return input.grantIds.length;
  if (Array.isArray(input.titles)) return input.titles.length;
  return 1;
}

export type AutonomyPolicyDecision =
  | { allowed: true }
  | { allowed: false; code: "autonomy_policy_required" | "autonomy_policy_disabled" | "autonomy_policy_expired" | "scope_insufficient" | "rate_limit_exceeded" | "batch_limit_exceeded"; message: string };

export function checkAutonomyPolicy(
  policy: AgentAutonomyPolicyRecord | null,
  usage: AgentAutonomyUsage,
  toolName: string,
  input: Record<string, unknown>,
  now = new Date(),
): AutonomyPolicyDecision {
  if (!policy) return { allowed: false, code: "autonomy_policy_required", message: "This token has no autonomous-operations policy. Create a new autonomous token in Agent Settings." };
  if (!policy.enabled) return { allowed: false, code: "autonomy_policy_disabled", message: "Autonomous operations are disabled for this token." };
  if (policy.expires_at && new Date(policy.expires_at) <= now) return { allowed: false, code: "autonomy_policy_expired", message: "This token's autonomous-operations policy has expired." };
  if (!AUTONOMOUS_TOOL_NAMES.has(toolName) || !policy.allowed_tools.includes(toolName)) {
    return { allowed: false, code: "scope_insufficient", message: `${toolName} is not allowlisted by this token's autonomy policy.` };
  }
  if (usage.writesToday >= policy.daily_write_limit) {
    return { allowed: false, code: "rate_limit_exceeded", message: `Autonomous daily write limit of ${policy.daily_write_limit} has been reached.` };
  }
  const batchSize = requestedBatchSize(input);
  if (batchSize > policy.max_batch_size) {
    return { allowed: false, code: "batch_limit_exceeded", message: `This request contains ${batchSize} records; the autonomy policy allows at most ${policy.max_batch_size}.` };
  }
  return { allowed: true };
}
