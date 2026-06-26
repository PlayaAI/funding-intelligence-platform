import { z } from "zod";
import {
  assertNormalUserAccessToken,
  describeAgentAuthContext,
  type AgentAuthContext,
} from "../agent-tools/authContext";
import { createLiveGrantOsRepository, type GrantOsRepository } from "../agent-tools/repository";
import { createToolRegistry } from "../agent-tools/registry";
import type { ToolActor, ToolExecutionResult } from "../agent-tools/types";
import {
  getSupabaseConfigError,
  getSupabaseProjectRef,
  hasSupabaseAnonKey,
  isSupabaseConfigured,
  isSupabaseUrlValid,
} from "../supabase";
import { getGrantOsDeploymentMetadata, type DeploymentMetadata } from "../deployment";

export const HOSTED_AGENT_READ_TOOLS = [
  "list_grants",
  "search_grants",
  "get_grant",
  // "get_grant_documents" removed — use get_documents_for_grant
  // "get_grant_applications" removed — use list_applications with grantId
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
  // "get_proof_items_for_project" removed — use list_proof_items with projectId
  "list_applications",
  "get_application",
  // "get_application_tasks" removed — use list_tasks with relatedApplicationId
  // "get_application_documents" removed — use get_documents_for_application
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
  "generate_application_readiness_report",
  "get_agent_context_brief",
  "list_agent_knowledge_items",
  "get_agent_knowledge_item",
  "get_grant_decision_brief",
  "get_application_prep_context",
  "list_grant_matches",
  "get_grant_match",
] as const;

export type HostedAgentReadTool = (typeof HOSTED_AGENT_READ_TOOLS)[number];

const hostedAgentReadToolSet = new Set<string>(HOSTED_AGENT_READ_TOOLS);

const toolRequestSchema = z.object({
  tool: z.string().trim().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
});

export type AgentApiResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type AgentApiHeaders = Record<string, string | string[] | undefined>;

export type CreateAgentApiDependencies = {
  createRepository?: (authContext: AgentAuthContext) => GrantOsRepository;
  createRegistry?: typeof createToolRegistry;
  getProjectRef?: () => string | null;
  getDeploymentMetadata?: () => DeploymentMetadata;
};

function maskProjectRef(projectRef: string | null): string | null {
  if (!projectRef) return null;
  if (projectRef.length <= 8) return "***";
  return `${projectRef.slice(0, 4)}...${projectRef.slice(-4)}`;
}

function getHeader(headers: AgentApiHeaders, name: string): string | null {
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

function jsonError(status: number, code: string, message: string): AgentApiResponse {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
}

function authError(code: string, message: string): AgentApiResponse {
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

function parseBearerAuth(headers: AgentApiHeaders): AgentAuthContext | AgentApiResponse {
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
    return authError("auth_expired", "Your agent session token has expired. Re-authenticate and retry once.");
  }

  try {
    assertNormalUserAccessToken(token);
  } catch {
    return authError("service_role_rejected", "Service-role tokens are not allowed. Do not retry — report this to the user.");
  }

  return {
    actorType: "delegated_agent",
    source: "hosted-agent-api",
    userId: typeof payload.sub === "string" ? payload.sub : null,
    userAccessToken: token,
    allowedTools: [...HOSTED_AGENT_READ_TOOLS],
  };
}

export function createAgentApi(dependencies: CreateAgentApiDependencies = {}) {
  const createRepository =
    dependencies.createRepository ??
    ((authContext: AgentAuthContext) => createLiveGrantOsRepository({ authContext }));
  const registryFactory = dependencies.createRegistry ?? createToolRegistry;
  const getProjectRef = dependencies.getProjectRef ?? getSupabaseProjectRef;
  const getDeploymentMetadata = dependencies.getDeploymentMetadata ?? getGrantOsDeploymentMetadata;

  function authenticate(headers: AgentApiHeaders): AgentAuthContext | AgentApiResponse {
    return parseBearerAuth(headers);
  }

  return {
    async handleTool(headers: AgentApiHeaders, rawBody: unknown): Promise<AgentApiResponse> {
      const authContext = authenticate(headers);
      if ("status" in authContext) return authContext;

      const parsed = toolRequestSchema.safeParse(rawBody ?? {});
      if (!parsed.success) {
        return jsonError(400, "invalid_request", parsed.error.message);
      }

      const { tool, input } = parsed.data;
      if (!hostedAgentReadToolSet.has(tool)) {
        return jsonError(403, "tool_not_allowed", "This tool is not enabled for the hosted Agent Tool API.");
      }

      const actor: ToolActor = {
        type: "agent",
        source: "external_agent",
        id: authContext.userId ?? "hosted-agent-api",
      };
      const registry = registryFactory({
        repository: createRepository(authContext),
        actor,
      });
      const result = (await registry.execute(tool, input ?? {})) as ToolExecutionResult<unknown>;
      return { status: result.ok ? 200 : 400, body: result as unknown as Record<string, unknown> };
    },

    async handleDoctor(headers: AgentApiHeaders): Promise<AgentApiResponse> {
      const authContext = authenticate(headers);
      if ("status" in authContext) return authContext;

      const authDescription = describeAgentAuthContext(authContext);
      const repository = createRepository(authContext);
      let grants: Array<{ id: string; title: string }> = [];
      let readError: string | null = null;

      try {
        const allGrants = await repository.listGrants();
        grants = allGrants.slice(0, 10);
      } catch (error) {
        readError = error instanceof Error ? error.message : String(error);
      }

      return {
        status: 200,
        body: {
          ok: true,
          deployment: getDeploymentMetadata(),
          supabase: {
            configured: isSupabaseConfigured,
            urlValid: isSupabaseUrlValid,
            configError: getSupabaseConfigError(),
            projectRef: maskProjectRef(getProjectRef()),
            anonKeyPresent: hasSupabaseAnonKey,
          },
          auth: {
            mode: authDescription.authMode,
            actorType: authDescription.actorType,
            userAccessTokenPresent: authDescription.userAccessTokenPresent,
          },
          grants: {
            visibleCount: grants.length,
            firstThreeTitles: grants.slice(0, 3).map((grant) => grant.title),
            humanityAiVisible: grants.some((grant) =>
              grant.title.toLowerCase().includes("humanity ai")
            ),
            readError,
          },
        },
      };
    },
  };
}
