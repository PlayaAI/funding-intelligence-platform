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

const mcpCallSchema = z.object({
  name: z.string().trim().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

type CreateMcpAdapterDependencies = {
  upstreamClient?: AgentApiClient;
  createRepository?: (authContext: AgentAuthContext) => GrantOsRepository;
  createRegistry?: (options?: CreateToolRegistryOptions) => ReturnType<typeof createToolRegistry>;
};

function jsonError(status: number, code: string, message: string): McpAdapterResponse {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
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

function authenticate(headers: McpAdapterHeaders): AgentAuthContext | McpAdapterResponse {
  const authorization = getHeader(headers, "authorization")?.trim();
  if (!authorization) {
    return authError("missing_authorization", "Authorization bearer token is required. Do not retry — report this to the user.");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return authError("malformed_authorization", "Authorization must use Bearer token format. Do not retry — report this to the user.");
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return authError("malformed_authorization", "Bearer token must be a well-formed JWT. Do not retry — report this to the user.");
  }

  // Detect expired JWT before any DB calls
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

function blockedToolResponse(): McpAdapterResponse {
  return {
    status: 403,
    body: {
      ok: false,
      blocked: true,
      error: {
        code: "approval_required_or_not_enabled",
        message: "This tool is not enabled for direct MCP execution.",
      },
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
  createRepository: (authContext: AgentAuthContext) => GrantOsRepository,
  registryFactory: (options?: CreateToolRegistryOptions) => ReturnType<typeof createToolRegistry>
) {
  const actor: ToolActor = {
    type: "agent",
    source: "external_agent",
    id: authContext.userId ?? "mcp-adapter",
  };
  return registryFactory({
    repository: createRepository(authContext),
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
      : "real_write";

  return {
    ok: true,
    tool: tool.name,
    permissionLevel: tool.permissionLevel,
    dryRun,
    mutationPerformed,
    writeDisposition,
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

export function createMcpAdapter(dependencies: CreateMcpAdapterDependencies = {}) {
  const upstreamClient = dependencies.upstreamClient ?? createInternalAgentApiClient();
  const createRepository = dependencies.createRepository ?? ((authContext: AgentAuthContext) => createLiveGrantOsRepository({ authContext }));
  const registryFactory = dependencies.createRegistry ?? createToolRegistry;

  return {
    async handleTools(headers: McpAdapterHeaders): Promise<McpAdapterResponse> {
      const authContext = authenticate(headers);
      if ("status" in authContext) {
        // If auth failed specifically because no token was supplied or it was malformed,
        // return the agent-friendly auth_required shape instead of the generic 401.
        const body = authContext.body as Record<string, unknown>;
        const errorCode = typeof body.error === "object" && body.error !== null
          ? (body.error as Record<string, unknown>).code
          : body.error;
        if (errorCode === "missing_authorization" || errorCode === "malformed_authorization") {
          return authRequiredForTools();
        }
        return authContext;
      }

      const registry = createRegistryForRequest(authContext, createRepository, registryFactory);
      return {
        status: 200,
        body: {
          ok: true,
          tools: buildMcpToolManifest(registry.listTools()),
          routing_policy: {
            version: "V2.11E",
            narrow_task_protocol: [
              "1. For narrow grant-ranking or fit questions (e.g. 'which grant should we apply for?', 'best fit', 'nearest deadline + best match'): call get_grant_decision_brief first. At most one follow-up targeted call.",
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
      const authContext = authenticate(headers);
      if ("status" in authContext) return authContext;

      const parsed = mcpCallSchema.safeParse(rawBody ?? {});
      if (!parsed.success) {
        return jsonError(400, "invalid_request", parsed.error.message);
      }

      const request = parsed.data as McpCallRequest;
      if (MCP_BLOCKED_TOOL_NAMES.has(request.name)) {
        return blockedToolResponse();
      }
      if (!MCP_ENABLED_TOOL_NAMES.has(request.name)) {
        return {
          status: 403,
          body: {
            ok: false,
            blocked: true,
            error: { code: "tool_not_allowed", message: "This tool is not enabled for the MCP-compatible adapter. Do not retry — check tool name and permissions." },
            do_not_retry: true,
          },
        };
      }

      const registry = createRegistryForRequest(authContext, createRepository, registryFactory);
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

      const input = normalizeArguments(request.name, request.arguments ?? {}, metadata);
      const result = await registry.execute(request.name, input);

      if (!result.ok) {
        return {
          status: result.error.code === "invalid_input" ? 400 : 403,
          body: {
            ok: false,
            tool: request.name,
            permissionLevel: metadata.permissionLevel,
            dryRun: inferDryRun(metadata, input),
            error: result.error,
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
      const authContext = authenticate(headers);
      if ("status" in authContext) return authContext;
      return upstreamClient.doctor(headers);
    },

    handleGuide(): McpAdapterResponse {
      return {
        status: 200,
        body: {
          ok: true,
          app: "Grant OS",
          version: "V2.11F",
          auth_required: true,
          auth_note: "Log in via the app, then call /api/mcp/tools or /api/mcp/call with the same authenticated browser session or user bearer token.",
          login_url: "/login",
          mcp_tools_url: "/api/mcp/tools",
          mcp_call_url: "/api/mcp/call",
          mcp_call_example: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer <token>"
            },
            body: {
              name: "list_grant_matches",
              arguments: {
                limit: 3,
                includeDetails: false
              }
            }
          },
          preferred_tools: {
            grant_recommendation: [
              "get_grant_decision_brief",
              "list_grant_matches",
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
          rules: [
            "Use MCP tools before inspecting raw data or running exports.",
            "Do not treat 401 from /api/mcp/tools as missing tools — it means auth is required.",
            "Use broad reports (get_deadline_report) or exports only when explicitly requested by the user.",
            "Return top 3 results maximum for grant recommendations unless the user asks for more.",
            "Prefer get_grant_decision_brief for any grant-ranking or fit question.",
            "Prefer get_application_prep_context for any application readiness question.",
          ],
        },
      };
    },
  };
}
