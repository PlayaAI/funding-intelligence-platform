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
      if ("status" in authContext) return authContext;

      const registry = createRegistryForRequest(authContext, createRepository, registryFactory);
      return {
        status: 200,
        body: {
          ok: true,
          tools: buildMcpToolManifest(registry.listTools()),
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
        return jsonError(403, "tool_not_allowed", "This tool is not enabled for the MCP-compatible adapter.");
      }

      const registry = createRegistryForRequest(authContext, createRepository, registryFactory);
      const metadata = registry.listTools().find((tool) => tool.name === request.name);
      if (!metadata) {
        return jsonError(404, "tool_not_found", `Unknown tool ${request.name}`);
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
  };
}
