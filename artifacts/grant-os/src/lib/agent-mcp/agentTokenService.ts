/**
 * agentTokenService.ts — V2.11H
 *
 * Pure logic for Grant OS MCP agent access tokens.
 * No HTTP, no database calls — those happen in the callers (adapter.ts, server.ts).
 *
 * Token format:  gos_mcp_<32 random hex chars>  (total 40 chars)
 * Token prefix:  first 16 chars stored for safe display (e.g. "gos_mcp_a1b2c3d4")
 *
 * Tokens are stored as SHA-256 hashes. Plaintext is shown once at creation only.
 */

import { createHash, randomBytes } from "node:crypto";

// ── Scopes ─────────────────────────────────────────────────────────────────

/**
 * Valid scopes for permissioned agent tokens. Real-write is recognised so the
 * adapter can return a precise approval_required response, but token creation
 * rejects it until an RLS-safe delegated authorization path exists.
 */
export const VALID_AGENT_TOKEN_SCOPES = [
  "mcp:read",
  "mcp:write_safe_dry_run",
  "mcp:write_safe_real",
  "mcp:grants:archive",
  "mcp:grants:update_status",
  "mcp:grants:top_three",
  "mcp:applications:create",
  "mcp:applications:update",
  "mcp:tasks:create",
  "mcp:tasks:update",
  "mcp:proof:read",
  "mcp:proof:update",
  "mcp:knowledge:read",
  "mcp:knowledge:propose",
  "mcp:audit:read",
] as const;

export type AgentTokenScope = (typeof VALID_AGENT_TOKEN_SCOPES)[number];

/** Normalise raw scopes and discard unknown values. The legacy
 * mcp:write_safe_execute name is downgraded to preview-only access. */
export function normaliseScopes(raw: string[]): AgentTokenScope[] {
  const out: AgentTokenScope[] = [];
  for (const s of raw) {
    if ((VALID_AGENT_TOKEN_SCOPES as readonly string[]).includes(s)) {
      const scope = s as AgentTokenScope;
      if (!out.includes(scope)) out.push(scope);
    }
    // mcp:write_safe_execute → downgrade silently
    if (s === "mcp:write_safe_execute" && !out.includes("mcp:write_safe_dry_run")) {
      out.push("mcp:write_safe_dry_run");
    }
    // Unknown scopes are silently dropped
  }
  // Ensure at least mcp:read
  if (out.length === 0) out.push("mcp:read");
  return out;
}

export function hasScope(scopes: string[], scope: AgentTokenScope): boolean {
  return scopes.includes(scope);
}

// ── Token generation & hashing ─────────────────────────────────────────────

const TOKEN_PREFIX_LITERAL = "gos_mcp_";
const TOKEN_RANDOM_BYTES = 16; // 16 bytes → 32 hex chars
const DISPLAY_PREFIX_LENGTH = 16; // first 16 chars of plaintext for safe display

/** Generate a fresh agent token. Returns plaintext (show once!), its SHA-256
 *  hash for storage, and a safe display prefix. */
export function generateAgentToken(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const randomHex = randomBytes(TOKEN_RANDOM_BYTES).toString("hex");
  const plaintext = `${TOKEN_PREFIX_LITERAL}${randomHex}`;
  return {
    plaintext,
    hash: hashAgentToken(plaintext),
    prefix: plaintext.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

/** SHA-256 hex digest of a token string. */
export function hashAgentToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Returns true when a bearer token string looks like an agent token (prefix check). */
export function isAgentTokenBearer(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX_LITERAL);
}

// ── Validation logic (DB record shape) ────────────────────────────────────

export type AgentTokenRecord = {
  id: string;
  user_id: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  label: string;
  token_prefix: string;
};

export type AgentTokenValidationResult =
  | { ok: true; record: AgentTokenRecord }
  | { ok: false; code: "agent_token_invalid" | "agent_token_expired" | "agent_token_revoked"; message: string };

/**
 * Validate a token record that was already fetched from the DB by hash lookup.
 * Call this AFTER the hash lookup — if the record is null, return agent_token_invalid.
 */
export function validateAgentTokenRecord(
  record: AgentTokenRecord | null
): AgentTokenValidationResult {
  if (!record) {
    return { ok: false, code: "agent_token_invalid", message: "Agent token not recognised. Do not retry — obtain a new token." };
  }
  if (record.revoked_at) {
    return { ok: false, code: "agent_token_revoked", message: "Agent token has been revoked. Create a new token from Grant OS." };
  }
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return { ok: false, code: "agent_token_expired", message: "Agent token has expired. Create a new token from Grant OS." };
  }
  return { ok: true, record };
}

// ── Scope enforcement (called from handleCall) ─────────────────────────────

export type ScopeCheckResult =
  | { allowed: true; forceDryRun: boolean; requiredScope: AgentTokenScope | null }
  | { allowed: false; code: "scope_insufficient" | "dry_run_required" | "approval_required"; message: string; requiredScope: AgentTokenScope | null };

const TOOL_SCOPES: Record<string, AgentTokenScope> = {
  archive_grant: "mcp:grants:archive",
  batch_archive_expired_grants: "mcp:grants:archive",
  mark_grant_status: "mcp:grants:update_status",
  update_grant_status: "mcp:grants:update_status",
  update_grant_notes: "mcp:grants:update_status",
  set_top_three_grant: "mcp:grants:top_three",
  remove_top_three_grant: "mcp:grants:top_three",
  create_application_from_grant: "mcp:applications:create",
  update_application_status: "mcp:applications:update",
  add_application_note: "mcp:applications:update",
  generate_application_checklist: "mcp:tasks:create",
  bulk_create_tasks_from_checklist: "mcp:tasks:create",
  create_task: "mcp:tasks:create",
  update_task_status: "mcp:tasks:update",
  update_task_due_date: "mcp:tasks:update",
  create_proof_item: "mcp:proof:update",
  update_proof_item_status: "mcp:proof:update",
  link_proof_item_to_grant: "mcp:proof:update",
  link_proof_item_to_project: "mcp:proof:update",
  propose_agent_knowledge_update: "mcp:knowledge:propose",
};

export function requiredScopeForTool(toolName: string): AgentTokenScope | null {
  return TOOL_SCOPES[toolName] ?? null;
}

/**
 * Check whether an agent token's scopes allow calling a tool of a given
 * permissionLevel, and whether dryRun must be forced.
 *
 * Rules:
 *  - "read" tools: allowed for mcp:read (and above).
 *  - "write_safe" tools: requires mcp:write_safe_dry_run; dryRun always forced true.
 *  - "approval_required" / "dangerous": never allowed (handled upstream by
 *    MCP_BLOCKED_TOOL_NAMES / MCP_ENABLED_TOOL_NAMES before we get here).
 */
export function checkAgentTokenScope(
  scopes: string[],
  permissionLevel: string,
  toolName = "",
  requestedDryRun = true,
): ScopeCheckResult {
  if (permissionLevel === "read") {
    // mcp:read is always present (enforced at normaliseScopes level)
    if (hasScope(scopes, "mcp:read")) {
      return { allowed: true, forceDryRun: false, requiredScope: null };
    }
    return { allowed: false, code: "scope_insufficient", message: "Token has no valid MCP read scope.", requiredScope: "mcp:read" };
  }

  if (permissionLevel === "write_safe") {
    const requiredScope = requiredScopeForTool(toolName);
    const granularScopes = Object.values(TOOL_SCOPES);
    const hasAnyGranularScope = scopes.some((scope) => granularScopes.includes(scope as AgentTokenScope));
    if (requiredScope && hasAnyGranularScope && !scopes.includes(requiredScope)) {
      return { allowed: false, code: "scope_insufficient", message: `This tool requires ${requiredScope}.`, requiredScope };
    }
    if (!requestedDryRun) {
      if (!hasScope(scopes, "mcp:write_safe_real")) {
        return { allowed: false, code: "dry_run_required", message: "This token can preview writes only. Retry with dryRun: true.", requiredScope: "mcp:write_safe_real" };
      }
      return {
        allowed: false,
        code: "approval_required",
        message: "Real writes from opaque agent tokens are disabled until RLS-safe delegated authorization is configured. Use an authenticated user session for an approved real write.",
        requiredScope: "mcp:write_safe_real",
      };
    }
    if (hasScope(scopes, "mcp:write_safe_dry_run")) {
      return { allowed: true, forceDryRun: true, requiredScope };
    }
    return {
      allowed: false,
      code: "scope_insufficient",
      message: "This token only has mcp:read scope and cannot call write_safe tools. Add mcp:write_safe_dry_run scope to a new token.",
      requiredScope: requiredScope ?? "mcp:write_safe_dry_run",
    };
  }

  // approval_required, dangerous, or unknown — should not reach here
  // (blocked by MCP_BLOCKED_TOOL_NAMES upstream), but guard defensively
  return {
    allowed: false,
    code: "scope_insufficient",
    message: "Agent tokens cannot call this tool.",
    requiredScope: null,
  };
}

// ── Safe logging helper ────────────────────────────────────────────────────

/** Returns a safe, masked representation of a token for logging. Never logs full value. */
export function maskAgentToken(plaintext: string): string {
  if (plaintext.length <= 12) return "gos_mcp_***";
  return `${plaintext.slice(0, 12)}...${plaintext.slice(-4)}`;
}
