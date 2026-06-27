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
 * Valid scopes for V2.11H agent tokens.
 * mcp:write_safe_execute is intentionally NOT defined here.
 * Any token claiming that scope is downgraded to mcp:write_safe_dry_run.
 */
export const VALID_AGENT_TOKEN_SCOPES = [
  "mcp:read",
  "mcp:write_safe_dry_run",
] as const;

export type AgentTokenScope = (typeof VALID_AGENT_TOKEN_SCOPES)[number];

/** Normalise an array of raw scope strings, discarding unknowns and downgrading
 *  future/invalid scopes. Never returns mcp:write_safe_execute. */
export function normaliseScopes(raw: string[]): AgentTokenScope[] {
  const out: AgentTokenScope[] = [];
  for (const s of raw) {
    if (s === "mcp:read" || s === "mcp:write_safe_dry_run") {
      if (!out.includes(s)) out.push(s);
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
  | { allowed: true; forceDryRun: boolean }
  | { allowed: false; code: "scope_insufficient"; message: string };

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
  permissionLevel: string
): ScopeCheckResult {
  if (permissionLevel === "read") {
    // mcp:read is always present (enforced at normaliseScopes level)
    if (hasScope(scopes, "mcp:read")) {
      return { allowed: true, forceDryRun: false };
    }
    return { allowed: false, code: "scope_insufficient", message: "Token has no valid MCP scope." };
  }

  if (permissionLevel === "write_safe") {
    if (hasScope(scopes, "mcp:write_safe_dry_run")) {
      // dryRun is ALWAYS forced true for agent tokens, regardless of caller input
      return { allowed: true, forceDryRun: true };
    }
    return {
      allowed: false,
      code: "scope_insufficient",
      message: "This token only has mcp:read scope and cannot call write_safe tools. Add mcp:write_safe_dry_run scope to a new token.",
    };
  }

  // approval_required, dangerous, or unknown — should not reach here
  // (blocked by MCP_BLOCKED_TOOL_NAMES upstream), but guard defensively
  return {
    allowed: false,
    code: "scope_insufficient",
    message: "Agent tokens cannot call this tool.",
  };
}

// ── Safe logging helper ────────────────────────────────────────────────────

/** Returns a safe, masked representation of a token for logging. Never logs full value. */
export function maskAgentToken(plaintext: string): string {
  if (plaintext.length <= 12) return "gos_mcp_***";
  return `${plaintext.slice(0, 12)}...${plaintext.slice(-4)}`;
}
