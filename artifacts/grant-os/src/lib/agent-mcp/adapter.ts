import { z } from "zod";
import {
  assertNormalUserAccessToken,
  type AgentAuthContext,
} from "../agent-tools/authContext";
import { createLiveGrantOsRepository, type GrantOsRepository } from "../agent-tools/repository";
import { createToolRegistry, type CreateToolRegistryOptions } from "../agent-tools/registry";
import type { ToolActor, ToolMetadata } from "../agent-tools/types";
import { type AgentApiClient, createInternalAgentApiClient } from "./client";
import { buildMcpToolManifest, MCP_BLOCKED_TOOL_NAMES, MCP_ENABLED_TOOL_NAMES } from "./toolManifest";
import type {
  JsonRecord,
  McpAdapterHeaders,
  McpAdapterResponse,
  McpCallRequest,
} from "./types";
import {
  isAgentTokenBearer,
  hashAgentToken,
  validateAgentTokenRecord,
  normaliseScopes,
  checkAgentTokenScope,
  maskAgentToken,
  requiredScopeForTool,
  type AgentTokenRecord,
} from "./agentTokenService";

const mcpCallSchema = z.object({
  name: z.string().trim().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

// ── Dependency types ────────────────────────────────────────────────────────

type CreateMcpAdapterDependencies = {
  upstreamClient?: AgentApiClient;
  createRepository?: (authContext: AgentAuthContext, serviceRoleKey?: string | null) => GrantOsRepository;
  createRegistry?: (options?: CreateToolRegistryOptions) => ReturnType<typeof createToolRegistry>;
  /**
   * Async resolver for agent token records by hash.
   * Returns null when the token is not found.
   * In production: fetches from agent_mcp_tokens using service-role client.
   * In tests: uses an in-memory map.
   */
  resolveAgentToken?: (hash: string) => Promise<AgentTokenRecord | null>;
  /**
   * Async function to update last_used_at for a token record.
   * Best-effort: errors are swallowed.
   */
  updateAgentTokenLastUsed?: (id: string) => Promise<void>;
  /** Service-role key, passed through to the repository for agent-token paths only. */
  serviceRoleKey?: string | null;
};

// ── Response helpers ────────────────────────────────────────────────────────

function jsonError(status: number, code: string, message: string): McpAdapterResponse {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
}

function canonicalToolErrorCode(code: string): string {
  if (code === "invalid_input") return "validation_failed";
  if (code.endsWith("_not_found") || code === "grant_not_found" || code === "project_not_found" || code === "task_not_found" || code === "application_not_found") return "record_not_found";
  if (code === "grant_expired") return "deadline_passed";
  return code;
}

function authError(code: string, message: string): McpAdapterResponse {
  return {
    status: 401,
    body: {
      ok: false,
      error: { code, message },
      do_not_retry: true,
      action_required: "report_to_user",
    },
  };
}

function authRequiredForTools(): McpAdapterResponse {
  return {
    status: 401,
    body: {
      ok: false,
      error: "auth_required",
      message: "Log in first, then retry /api/mcp/tools with the authenticated session. This is an auth error, not a missing-tools error.",
      login_url: "/login",
      agent_guide_url: "/api/agent/guide",
      do_not_treat_as_missing_tools: true,
      do_not_retry: true,
    },
  };
}

// ── Header helpers ──────────────────────────────────────────────────────────

function getHeader(headers: McpAdapterHeaders, name: string): string | null {
  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
  const value = entry?.[1];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── JWT auth path (unchanged from V2.11G) ──────────────────────────────────

function authenticateJwt(token: string): AgentAuthContext | McpAdapterResponse {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return authError("malformed_authorization", "Bearer token must be a well-formed JWT. Do not retry — report this to the user.");
  }

  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    return authError("auth_expired", "Your MCP session token has expired. Re-authenticate and retry once.");
  }

  try {
    assertNormalUserAccessToken(token);
  } catch {
    return authError("service_role_rejected", "Service-role tokens are not allowed. Do not retry — report this to the user.");
  }

  return {
    actorType: "mcp_agent",
    source: "mcp-adapter",
    userId: typeof payload.sub === "string" ? payload.sub : null,
    userAccessToken: token,
  };
}

// ── Agent-token auth path (V2.11H) ─────────────────────────────────────────

async function authenticateAgentToken(
  token: string,
  resolveToken: (hash: string) => Promise<AgentTokenRecord | null>,
  updateLastUsed: (id: string) => Promise<void>
): Promise<AgentAuthContext | McpAdapterResponse> {
  // Never log the full token value
  const maskedToken = maskAgentToken(token);
  void maskedToken; // available for debug if needed

  const hash = hashAgentToken(token);
  let record: AgentTokenRecord | null;
  try {
    record = await resolveToken(hash);
  } catch {
    return authError("agent_token_invalid", "Agent token lookup failed. Do not retry — report this to the user.");
  }

  const validation = validateAgentTokenRecord(record);
  if (!validation.ok) {
    return authError(validation.code, validation.message);
  }

  const { record: validRecord } = validation;
  const scopes = normaliseScopes(validRecord.scopes);

  // Best-effort last_used_at update (fire-and-forget, no await blocking path)
  updateLastUsed(validRecord.id).catch(() => { /* swallow */ });

  return {
    actorType: "mcp_agent",
    source: "agent-token",
    userId: validRecord.user_id,
    userAccessToken: null, // opaque token has no delegated Supabase user JWT
    agentTokenScopes: scopes,
    agentTokenMetadata: {
      id: validRecord.id,
      label: validRecord.label,
      tokenPrefix: validRecord.token_prefix,
      createdAt: validRecord.created_at ?? null,
      expiresAt: validRecord.expires_at,
      revokedAt: validRecord.revoked_at,
      lastUsedAt: validRecord.last_used_at ?? null,
    },
  };
}

// ── Combined authenticate ───────────────────────────────────────────────────

async function authenticate(
  headers: McpAdapterHeaders,
  resolveToken: (hash: string) => Promise<AgentTokenRecord | null>,
  updateLastUsed: (id: string) => Promise<void>
): Promise<AgentAuthContext | McpAdapterResponse> {
  const authorization = getHeader(headers, "authorization")?.trim();
  if (!authorization) {
    return authError("missing_authorization", "Authorization bearer token is required. Do not retry — report this to the user.");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return authError("malformed_authorization", "Authorization must use Bearer token format. Do not retry — report this to the user.");
  }

  // Branch: agent token vs Supabase JWT
  if (isAgentTokenBearer(token)) {
    return authenticateAgentToken(token, resolveToken, updateLastUsed);
  }
  return authenticateJwt(token);
}

// ── Tool helpers ────────────────────────────────────────────────────────────

function blockedToolResponse(): McpAdapterResponse {
  return {
    status: 403,
    body: {
      ok: false,
      blocked: true,
      error: {
        code: "unsupported_operation",
        message: "This tool is not enabled for direct MCP execution.",
      },
    },
  };
}

function scopeDeniedResponse(code: "scope_insufficient" | "dry_run_required" | "approval_required", message: string, requiredScope: string | null): McpAdapterResponse {
  return {
    status: 403,
    body: {
      ok: false,
      blocked: true,
      error: {
        code,
        message,
      },
      requiredScope,
      dryRun: null,
      mutationPerformed: false,
      writeDisposition: "rejected",
      do_not_retry: true,
    },
  };
}

function normalizeArguments(toolName: string, rawArguments: JsonRecord, metadata?: ToolMetadata): JsonRecord {
  const input: JsonRecord = { ...rawArguments };

  if (toolName === "create_task") {
    if (typeof input.applicationId === "string" && typeof input.relatedApplicationId !== "string") {
      input.relatedApplicationId = input.applicationId;
    }
  }

  if (metadata?.permissionLevel === "write_safe" && metadata.dryRunSupported && typeof input.dryRun !== "boolean") {
    input.dryRun = true;
  }

  return input;
}

function createRegistryForRequest(
  authContext: AgentAuthContext,
  createRepository: (authContext: AgentAuthContext, serviceRoleKey?: string | null) => GrantOsRepository,
  registryFactory: (options?: CreateToolRegistryOptions) => ReturnType<typeof createToolRegistry>,
  serviceRoleKey?: string | null
) {
  const actor: ToolActor = {
    type: "agent",
    source: "external_agent",
    id: authContext.userId ?? "mcp-adapter",
  };
  return registryFactory({
    repository: createRepository(authContext, serviceRoleKey),
    actor,
  });
}

function inferDryRun(tool: ToolMetadata | undefined, input: JsonRecord, data?: unknown): boolean | null {
  if (!tool || tool.permissionLevel === "read") return null;
  if (data && typeof data === "object" && "dryRun" in (data as JsonRecord) && typeof (data as JsonRecord).dryRun === "boolean") {
    return Boolean((data as JsonRecord).dryRun);
  }
  if (typeof input.dryRun === "boolean") return input.dryRun;
  return tool.dryRunSupported ? true : null;
}

function inferMutationPerformed(tool: ToolMetadata | undefined, input: JsonRecord, data?: unknown): boolean | null {
  if (!tool || tool.permissionLevel === "read") return null;
  if (data && typeof data === "object" && "mutationPerformed" in (data as JsonRecord) && typeof (data as JsonRecord).mutationPerformed === "boolean") {
    return Boolean((data as JsonRecord).mutationPerformed);
  }
  return inferDryRun(tool, input, data) ? false : null;
}

function normalizeCallSuccess(tool: ToolMetadata, input: JsonRecord, data: unknown, audit: JsonRecord | null): JsonRecord {
  const dryRun = inferDryRun(tool, input, data);
  const mutationPerformed = inferMutationPerformed(tool, input, data);
  const writeDisposition = tool.permissionLevel === "read"
    ? "read"
    : dryRun
      ? "dry_run"
      : "committed";
  const resultData = data && typeof data === "object" ? data as JsonRecord : {};
  const affectedRecordIds = Array.isArray(resultData.affectedRecordIds) ? resultData.affectedRecordIds : [];
  const plannedMutation = resultData.plannedMutation ?? (resultData.planned_mutation ?? null);
  const appliedMutation = resultData.appliedMutation ?? null;

  return {
    ok: true,
    tool: tool.name,
    permissionLevel: tool.permissionLevel,
    dryRun,
    mutationPerformed,
    writeDisposition,
    affectedRecordIds,
    plannedMutation: dryRun ? plannedMutation : null,
    appliedMutation: mutationPerformed ? appliedMutation : null,
    requiredScopeForRealWrite: tool.permissionLevel === "write_safe" ? "mcp:write_safe_real" : null,
    data,
    truncated: Boolean(resultData.truncated),
    warnings: Array.isArray(resultData.warnings) ? resultData.warnings : [],
    content: [
      {
        type: "json",
        json: {
          data,
          dryRun,
          mutationPerformed,
          writeDisposition,
        },
      },
    ],
    audit,
  };
}

const VIRTUAL_TOOL_NAMES = new Set(["get_agent_token_self", "list_mcp_capabilities"]);

function toolAllowedForContext(
  authContext: AgentAuthContext,
  metadata: ToolMetadata,
): { allowed: boolean; reason: string | null; requiredScope: string | null } {
  if (authContext.source !== "agent-token") {
    return { allowed: true, reason: null, requiredScope: null };
  }
  const check = checkAgentTokenScope(
    authContext.agentTokenScopes ?? [],
    metadata.permissionLevel,
    metadata.name,
    true,
  );
  return check.allowed
    ? { allowed: true, reason: null, requiredScope: check.requiredScope }
    : { allowed: false, reason: check.message, requiredScope: check.requiredScope };
}

function buildCapabilities(authContext: AgentAuthContext, tools: ToolMetadata[]) {
  return tools
    .filter((tool) => MCP_ENABLED_TOOL_NAMES.has(tool.name))
    .map((tool) => {
      const access = toolAllowedForContext(authContext, tool);
      return {
        name: tool.name,
        permissionLevel: tool.permissionLevel,
        requiredScopes: [
          tool.permissionLevel === "read" ? "mcp:read" : "mcp:write_safe_dry_run",
          requiredScopeForTool(tool.name),
        ].filter(Boolean),
        supportsDryRun: tool.dryRunSupported,
        canMutate: tool.permissionLevel === "write_safe",
        responseMode: tool.name.includes("compact") || tool.name.includes("brief") ? "compact" : "standard",
        currentlyAllowed: access.allowed,
        reason: access.reason,
      };
    });
}

function virtualToolResponse(
  name: string,
  authContext: AgentAuthContext,
  tools: ToolMetadata[],
): McpAdapterResponse {
  const capabilities = buildCapabilities(authContext, tools);
  const scopes = authContext.agentTokenScopes ?? ["authenticated_user"];
  const metadata = authContext.agentTokenMetadata;
  const data = name === "get_agent_token_self"
    ? {
        token: metadata
          ? {
              fingerprint: `${metadata.tokenPrefix}…`,
              label: metadata.label,
              created_at: metadata.createdAt,
              expires_at: metadata.expiresAt,
              revoked_at: metadata.revokedAt,
              last_used_at: metadata.lastUsedAt,
            }
          : { fingerprint: "user-session", label: "Authenticated user session" },
        actor: { type: authContext.actorType, userId: authContext.userId ?? null, source: authContext.source },
        scopes,
        permissionLevel: scopes.includes("mcp:write_safe_real") ? "write_safe_real" : scopes.includes("mcp:write_safe_dry_run") ? "write_safe_dry_run" : "read",
        canRead: authContext.source !== "agent-token" || scopes.includes("mcp:read"),
        canPreviewWrites: authContext.source !== "agent-token" || scopes.includes("mcp:write_safe_dry_run"),
        canRealWrite: authContext.source !== "agent-token",
        allowedToolNames: capabilities.filter((tool) => tool.currentlyAllowed).map((tool) => tool.name),
        deniedToolNames: capabilities.filter((tool) => !tool.currentlyAllowed).map((tool) => tool.name),
        warnings: authContext.source === "agent-token"
          ? ["Opaque agent tokens cannot perform real writes until RLS-safe delegated authorization exists."]
          : ["Real writes use the authenticated user session and remain subject to Supabase RLS."],
      }
    : {
        groups: {
          read: capabilities.filter((tool) => tool.permissionLevel === "read"),
          write_safe: capabilities.filter((tool) => tool.permissionLevel === "write_safe"),
          admin: [],
          disabled: Array.from(MCP_BLOCKED_TOOL_NAMES).map((tool) => ({ name: tool, currentlyAllowed: false, reason: "blocked" })),
        },
        counts: {
          read: capabilities.filter((tool) => tool.permissionLevel === "read").length,
          write_safe: capabilities.filter((tool) => tool.permissionLevel === "write_safe").length,
          disabled: MCP_BLOCKED_TOOL_NAMES.size,
        },
        warnings: ["Tool schemas and long examples are omitted to reduce token usage."],
      };
  return {
    status: 200,
    body: {
      ok: true,
      tool: name,
      permissionLevel: "read",
      dryRun: null,
      mutationPerformed: null,
      writeDisposition: "read",
      affectedRecordIds: [],
      data,
      truncated: false,
      warnings: "warnings" in data ? data.warnings : [],
      audit: {
        tool_name: name,
        actor_type: "agent",
        actor_id: authContext.userId ?? null,
        permission_level: "read",
        dry_run: false,
        status: "completed",
        created_at: new Date().toISOString(),
      },
    },
  };
}

// ── Default no-op resolvers (used when service-role not configured) ──────────

function makeNoopResolveToken(): (hash: string) => Promise<AgentTokenRecord | null> {
  return async (_hash) => null;
}

function makeNoopUpdateLastUsed(): (id: string) => Promise<void> {
  return async (_id) => { /* no-op */ };
}

// ── Adapter factory ─────────────────────────────────────────────────────────

export function createMcpAdapter(dependencies: CreateMcpAdapterDependencies = {}) {
  const upstreamClient = dependencies.upstreamClient ?? createInternalAgentApiClient();

  // Default repository factory forwards serviceRoleKey to the repository
  const createRepository = dependencies.createRepository ??
    ((authContext: AgentAuthContext, serviceRoleKey?: string | null) =>
      createLiveGrantOsRepository({ authContext, serviceRoleKey }));

  const registryFactory = dependencies.createRegistry ?? createToolRegistry;

  // The service-role key is only used for agent-token paths after all checks pass
  const serviceRoleKey = dependencies.serviceRoleKey ??
    (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null);

  // Agent token resolvers — injected in tests, DB-backed in production
  const resolveAgentToken = dependencies.resolveAgentToken ?? makeNoopResolveToken();
  const updateAgentTokenLastUsed = dependencies.updateAgentTokenLastUsed ?? makeNoopUpdateLastUsed();

  return {
    async handleTools(headers: McpAdapterHeaders): Promise<McpAdapterResponse> {
      const authResult = await authenticate(headers, resolveAgentToken, updateAgentTokenLastUsed);
      if ("status" in authResult) {
        const body = authResult.body as Record<string, unknown>;
        const errorCode = typeof body.error === "object" && body.error !== null
          ? (body.error as Record<string, unknown>).code
          : body.error;
        if (errorCode === "missing_authorization" || errorCode === "malformed_authorization") {
          return authRequiredForTools();
        }
        return authResult;
      }

      const authContext = authResult;
      // For agent-token paths, tool listing is always allowed regardless of scope
      // (listing is metadata-only, no data returned)
      const registry = createRegistryForRequest(authContext, createRepository, registryFactory, serviceRoleKey);
      const registryTools = registry.listTools();
      return {
        status: 200,
        body: {
          ok: true,
          tools: [
            {
              name: "get_agent_token_self",
              description: "Return safe metadata and effective capabilities for the current credential.",
              permissionLevel: "read",
              enabled: true,
              schemaSummary: "{}",
            },
            {
              name: "list_mcp_capabilities",
              description: "Return a compact token-aware MCP capability manifest.",
              permissionLevel: "read",
              enabled: true,
              schemaSummary: "{}",
            },
            ...buildMcpToolManifest(registryTools),
          ],
          routing_policy: {
            version: "V2.11J",
            narrow_task_protocol: [
              "1. For narrow grant-ranking or fit questions (e.g. 'which grant should we apply for?'): call get_agent_context_brief and list_agent_knowledge_items FIRST to align with Playa AI strategy, then call get_grant_decision_brief.",
              "2. For application-prep questions: call get_application_prep_context first.",
              "3. For existing match overview: call list_grant_matches (compact stubs, no includeDetails).",
              "4. Do NOT call get_deadline_report for narrow ranking tasks — it reads the full grants table.",
              "5. Do NOT load broad exports (export_grant_packet, export_application_packet) unless the user explicitly asks for a packet or full context.",
              "6. Do NOT call list_projects, list_tasks, or list_documents system-wide unless a broad overview is explicitly requested.",
              "7. Return top 3 results maximum unless the user asks for more.",
              "8. Keep replies short. One compact composite call is enough for most narrow tasks.",
            ],
            preferred_tools_for_narrow_tasks: [
              "get_grant_decision_brief",
              "get_application_prep_context",
              "list_grant_matches",
              "get_agent_context_brief",
            ],
            avoid_for_narrow_tasks: [
              "get_deadline_report",
              "export_grant_packet",
              "export_application_packet",
              "list_projects (system-wide)",
              "list_tasks (system-wide)",
              "list_documents (system-wide)",
            ],
          },
        },
      };
    },

    async handleCall(headers: McpAdapterHeaders, rawBody: unknown): Promise<McpAdapterResponse> {
      const authResult = await authenticate(headers, resolveAgentToken, updateAgentTokenLastUsed);
      if ("status" in authResult) return authResult;

      const authContext = authResult;

      const parsed = mcpCallSchema.safeParse(rawBody ?? {});
      if (!parsed.success) {
        return jsonError(400, "invalid_request", parsed.error.message);
      }

      const request = parsed.data as McpCallRequest;

      if (VIRTUAL_TOOL_NAMES.has(request.name)) {
        const registry = createRegistryForRequest(authContext, createRepository, registryFactory, serviceRoleKey);
        return virtualToolResponse(request.name, authContext, registry.listTools());
      }

      // ── Guardrail 3: tool must be in enabled set ──────────────────────────
      if (MCP_BLOCKED_TOOL_NAMES.has(request.name)) {
        return blockedToolResponse();
      }
      // ── Guardrail 4: tool must not be blocked ─────────────────────────────
      if (!MCP_ENABLED_TOOL_NAMES.has(request.name)) {
        return {
          status: 403,
          body: {
            ok: false,
            blocked: true,
            error: { code: "unsupported_operation", message: "This tool is not enabled for the MCP-compatible adapter. Do not retry — check tool name and permissions." },
            mutationPerformed: false,
            writeDisposition: "rejected",
            do_not_retry: true,
          },
        };
      }

      const registry = createRegistryForRequest(authContext, createRepository, registryFactory, serviceRoleKey);
      const metadata = registry.listTools().find((tool) => tool.name === request.name);
      if (!metadata) {
        return {
          status: 404,
          body: {
            ok: false,
            error: { code: "tool_not_found", message: `Unknown tool ${request.name}. Do not retry — check the tool name.` },
            do_not_retry: true,
          },
        };
      }

      // ── Guardrail 5: agent-token scope check ──────────────────────────────
      // Only applied when the request comes in via an agent token.
      // Normal JWT paths are not scope-restricted here.
      let input = normalizeArguments(request.name, request.arguments ?? {}, metadata);

      if (authContext.source === "agent-token") {
        const scopes = authContext.agentTokenScopes ?? [];
        const requestedDryRun = input.dryRun !== false;
        const scopeCheck = checkAgentTokenScope(scopes, metadata.permissionLevel, request.name, requestedDryRun);
        if (!scopeCheck.allowed) {
          return scopeDeniedResponse(scopeCheck.code, scopeCheck.message, scopeCheck.requiredScope);
        }
        // Accepted opaque-token mutations are preview-only. Explicit
        // dryRun:false requests were rejected above and are never downgraded.
        if (scopeCheck.forceDryRun) {
          input = { ...input, dryRun: true };
        }
      }

      const result = await registry.execute(request.name, input);

      if (!result.ok) {
        const errorCode = canonicalToolErrorCode(result.error.code);
        return {
          status: result.error.code === "invalid_input" ? 400 : result.error.code.includes("not_found") ? 404 : 403,
          body: {
            ok: false,
            tool: request.name,
            permissionLevel: metadata.permissionLevel,
            dryRun: inferDryRun(metadata, input),
            mutationPerformed: false,
            writeDisposition: "rejected",
            affectedRecordIds: [],
            error: { ...result.error, code: errorCode },
            requiredScope: metadata.permissionLevel === "write_safe" ? requiredScopeForTool(request.name) : null,
            audit: result.audit ?? null,
          },
        };
      }

      return {
        status: 200,
        body: normalizeCallSuccess(metadata, input, result.data, (result.audit ?? null) as JsonRecord | null),
      };
    },

    async handleDoctor(headers: McpAdapterHeaders): Promise<McpAdapterResponse> {
      // Doctor still requires a normal Supabase JWT — no agent-token path here
      const authResult = await authenticate(headers, resolveAgentToken, updateAgentTokenLastUsed);
      if ("status" in authResult) return authResult;
      // Reject agent tokens on the doctor route
      if (authResult.source === "agent-token") {
        return authError("agent_token_not_allowed", "Agent tokens are not valid for the doctor route. Use a normal user session.");
      }
      return upstreamClient.doctor(headers);
    },

    handleGuide(): McpAdapterResponse {
      return {
        status: 200,
        body: {
          ok: true,
          app: "Grant OS",
          version: "V2.11J",
          auth_required: true,
          preferred_auth_for_external_agents: "Authorization: Bearer <agent_access_token>",
          how_to_get_agent_token: "Create one via POST /api/agent/tokens using a logged-in user session. Plaintext is shown once only.",
          alternative_auth: "Authenticated browser session or Supabase user bearer token (JWT).",
          do_not_store: "Never store email or password in agent memory.",
          if_token_fails: "If token is expired or revoked, create a new one from Grant OS via POST /api/agent/tokens.",
          login_url: "/login",
          mcp_tools_url: "/api/mcp/tools",
          mcp_call_url: "/api/mcp/call",
          mcp_call_example: {
            method: "POST",
            url: "/api/mcp/call",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer gos_mcp_<your_token>",
            },
            body: {
              name: "list_grant_matches",
              arguments: {
                limit: 3,
                includeDetails: false,
              },
            },
          },
          preferred_tools: {
            grant_recommendation: [
              "get_agent_context_brief",
              "list_agent_knowledge_items",
              "list_grant_matches",
              "get_grant_decision_brief",
            ],
            application_preparation: [
              "get_application_prep_context",
            ],
            knowledge: [
              "list_agent_knowledge_items",
              "get_agent_knowledge_item",
            ],
            workspace_orientation: [
              "get_agent_context_brief",
            ],
          },
          token_error_codes: {
            agent_token_invalid: "Token not recognised — obtain a new token.",
            agent_token_expired: "Token past expires_at — create a new token.",
            agent_token_revoked: "Token revoked — create a new token.",
            agent_token_not_allowed: "Agent token used on a non-MCP route — use a user session for that route.",
            scope_insufficient: "Token scope does not permit this tool — re-create token with required scope.",
          },
          rules: [
            "Use MCP tools before inspecting raw data or running exports.",
            "Do not treat 401 from /api/mcp/tools as missing tools — it means auth is required.",
            "Use broad reports (get_deadline_report) or exports only when explicitly requested by the user.",
            "Return top 3 results maximum for grant recommendations unless the user asks for more.",
            "For any grant-ranking or fit question, check get_agent_context_brief and list_agent_knowledge_items FIRST, then use get_grant_decision_brief.",
            "Prefer get_application_prep_context for any application readiness question.",
          ],
        },
      };
    },
  };
}
