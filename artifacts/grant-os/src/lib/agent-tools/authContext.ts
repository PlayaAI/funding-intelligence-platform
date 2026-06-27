export type AgentActorType = "cli" | "dashboard_user" | "delegated_agent" | "mcp_agent";

export interface AgentAuthContext {
  actorType: AgentActorType;
  source: string;
  userId?: string | null;
  /**
   * Normal Supabase user JWT only. Never use a service-role token here.
   * The token is used per request with the public anon key so RLS still applies.
   */
  userAccessToken?: string | null;
  delegatedToken?: string | null;
  allowedTools?: string[];
  expiresAt?: string | null;
  /**
   * Set only when source === "agent-token" (V2.11H agent MCP access tokens).
   * Contains the validated, normalised scopes from the token record.
   * Never present for normal Supabase JWT paths.
   */
  agentTokenScopes?: string[] | null;
}

export type AgentAuthMode = "anonymous" | "authenticated";

export function getAgentAuthMode(authContext?: AgentAuthContext): AgentAuthMode {
  return authContext?.userAccessToken?.trim() ? "authenticated" : "anonymous";
}

export function maskSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return "***";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function describeAgentAuthContext(authContext?: AgentAuthContext) {
  return {
    actorType: authContext?.actorType ?? "cli",
    source: authContext?.source ?? "anonymous",
    userId: authContext?.userId ?? null,
    authMode: getAgentAuthMode(authContext),
    userAccessTokenPresent: Boolean(authContext?.userAccessToken?.trim()),
    delegatedTokenPresent: Boolean(authContext?.delegatedToken?.trim()),
    allowedTools: authContext?.allowedTools ?? null,
    expiresAt: authContext?.expiresAt ?? null,
  };
}

export function isToolAllowedForAgentContext(
  toolName: string,
  authContext?: AgentAuthContext
): boolean {
  if (!authContext?.allowedTools?.length) return true;
  return authContext.allowedTools.includes(toolName);
}

/**
 * Returns the agent token scopes when source === "agent-token", otherwise null.
 * Used by the MCP adapter scope enforcement layer (V2.11H).
 */
export function getAgentTokenScopes(authContext?: AgentAuthContext): string[] | null {
  if (authContext?.source !== "agent-token") return null;
  return authContext.agentTokenScopes ?? null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getJwtRoleWithoutVerification(token: string | null | undefined): string | null {
  const trimmed = token?.trim();
  if (!trimmed) return null;
  const payload = decodeJwtPayload(trimmed);
  const role = payload?.role;
  return typeof role === "string" ? role : null;
}

export function assertNormalUserAccessToken(token: string | null | undefined): void {
  const role = getJwtRoleWithoutVerification(token);
  if (role === "service_role") {
    throw new Error("GRANT_OS_USER_ACCESS_TOKEN must be a normal Supabase user access token, not a service-role key.");
  }
}
