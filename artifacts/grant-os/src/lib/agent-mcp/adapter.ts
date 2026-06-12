import { z } from "zod";
import { assertNormalUserAccessToken } from "../agent-tools/authContext";
import { type AgentApiClient, createInternalAgentApiClient } from "./client";
import { MCP_READ_TOOL_MANIFEST, MCP_READ_TOOL_NAMES } from "./toolManifest";
import type {
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

function requireBearerAuth(headers: McpAdapterHeaders): McpAdapterResponse | null {
  const authorization = getHeader(headers, "authorization")?.trim();
  if (!authorization) {
    return jsonError(401, "missing_authorization", "Authorization bearer token is required.");
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return jsonError(401, "malformed_authorization", "Authorization must use Bearer token format.");
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return jsonError(401, "malformed_authorization", "Bearer token must be a well-formed JWT.");
  }

  try {
    assertNormalUserAccessToken(token);
  } catch {
    return jsonError(401, "service_role_rejected", "Service-role tokens are not allowed.");
  }

  return null;
}

function toolNotAllowed(): McpAdapterResponse {
  return jsonError(403, "tool_not_allowed", "This tool is not enabled for the MCP-compatible adapter.");
}

function normalizeCallSuccess(toolName: string, upstreamBody: Record<string, unknown>): Record<string, unknown> {
  return {
    ok: true,
    tool: toolName,
    content: [
      {
        type: "json",
        json: {
          data: upstreamBody.data ?? null,
        },
      },
    ],
    audit: upstreamBody.audit ?? null,
  };
}

export function createMcpAdapter(dependencies: CreateMcpAdapterDependencies = {}) {
  const upstreamClient = dependencies.upstreamClient ?? createInternalAgentApiClient();

  return {
    async handleTools(headers: McpAdapterHeaders): Promise<McpAdapterResponse> {
      const authError = requireBearerAuth(headers);
      if (authError) return authError;

      return {
        status: 200,
        body: {
          ok: true,
          tools: [...MCP_READ_TOOL_MANIFEST],
        },
      };
    },

    async handleCall(headers: McpAdapterHeaders, rawBody: unknown): Promise<McpAdapterResponse> {
      const authError = requireBearerAuth(headers);
      if (authError) return authError;

      const parsed = mcpCallSchema.safeParse(rawBody ?? {});
      if (!parsed.success) {
        return jsonError(400, "invalid_request", parsed.error.message);
      }

      const request = parsed.data as McpCallRequest;
      if (!MCP_READ_TOOL_NAMES.has(request.name)) {
        return toolNotAllowed();
      }

      const upstreamResult = await upstreamClient.tool(headers, {
        tool: request.name,
        input: request.arguments ?? {},
      });

      if (!upstreamResult.body.ok) {
        return {
          status: upstreamResult.status,
          body: {
            ok: false,
            tool: request.name,
            error: upstreamResult.body.error ?? {
              code: "upstream_error",
              message: "Agent tool request failed.",
            },
            audit: upstreamResult.body.audit ?? null,
          },
        };
      }

      return {
        status: upstreamResult.status,
        body: normalizeCallSuccess(request.name, upstreamResult.body),
      };
    },

    async handleDoctor(headers: McpAdapterHeaders): Promise<McpAdapterResponse> {
      const authError = requireBearerAuth(headers);
      if (authError) return authError;
      return upstreamClient.doctor(headers);
    },
  };
}
