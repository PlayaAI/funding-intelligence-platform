import type { GrantOsRepository } from "./repository";
import type { ToolAuditPayload } from "./types";

export type AgentToolAuditLogger = {
  log(payload: ToolAuditPayload): Promise<void>;
};

export function createAuditLogger(repository: GrantOsRepository): AgentToolAuditLogger {
  return {
    async log(payload) {
      try {
        await repository.recordAudit(payload);
      } catch {
        // Non-invasive audit logging: tool execution should continue if audit persistence fails.
        console.info("[grant-os agent-tools audit fallback]", payload.tool_name, payload.status);
      }
    },
  };
}
