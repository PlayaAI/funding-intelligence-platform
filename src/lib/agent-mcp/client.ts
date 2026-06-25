import type { CreateAgentApiDependencies } from "../agent-api/agentApi";
import { createAgentApi } from "../agent-api/agentApi";
import type {
  AgentApiClientResponse,
  AgentToolForwardRequest,
  McpAdapterHeaders,
} from "./types";

export interface AgentApiClient {
  doctor(headers: McpAdapterHeaders): Promise<AgentApiClientResponse>;
  tool(headers: McpAdapterHeaders, body: AgentToolForwardRequest): Promise<AgentApiClientResponse>;
}

export function createInternalAgentApiClient(
  dependencies: CreateAgentApiDependencies = {}
): AgentApiClient {
  const agentApi = createAgentApi(dependencies);
  return {
    doctor(headers) {
      return agentApi.handleDoctor(headers);
    },
    tool(headers, body) {
      return agentApi.handleTool(headers, body);
    },
  };
}
