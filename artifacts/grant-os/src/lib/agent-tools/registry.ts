import { createAuditLogger } from "./audit";
import { createAgentPlanningTools } from "./agentPlanningTools";
import { createApplicationTools } from "./applicationsTools";
import { createDocumentTools } from "./documentsTools";
import { createFunderTools } from "./fundersTools";
import { createGrantTools } from "./grantsTools";
import { createMatchTools } from "./matchesTools";
import { createMutationTools } from "./mutationsTools";
import { createPeerTools } from "./peersTools";
import { createProjectTools } from "./projectsTools";
import { createKnowledgeTools } from "./knowledgeTools";
import { createLiveGrantOsRepository, type GrantOsRepository } from "./repository";
import { createReportTools } from "./reportsTools";
import { makeAuditPayload, normalizeError, summarizeOutput } from "./safety";
import { createTaskTools } from "./tasksTools";
import type { ToolActor, ToolDefinition, ToolExecutionResult, ToolMetadata } from "./types";

export type CreateToolRegistryOptions = {
  repository?: GrantOsRepository;
  actor?: ToolActor;
};

export function buildToolDefinitions(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    ...createGrantTools(repository),
    ...createFunderTools(repository),
    ...createDocumentTools(repository),
    ...createProjectTools(repository),
    ...createApplicationTools(repository),
    ...createTaskTools(repository),
    ...createPeerTools(repository),
    ...createMatchTools(repository),
    ...createReportTools(repository),
    ...createAgentPlanningTools(repository),
    ...createMutationTools(repository),
    ...createKnowledgeTools(repository),
  ];
}

export function createToolRegistry(options: CreateToolRegistryOptions = {}) {
  const repository: GrantOsRepository = options.repository ?? createLiveGrantOsRepository();
  const actor: ToolActor = options.actor ?? { type: "agent", source: "external_agent", id: null };
  const tools = buildToolDefinitions(repository);
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const auditLogger = createAuditLogger(repository);

  return {
    listTools(): ToolMetadata[] {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        permissionLevel: tool.permissionLevel,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        dryRunSupported: tool.dryRunSupported,
        auditAction: tool.auditAction,
        risks: tool.risks,
        relatedTables: tool.relatedTables,
        touchesRealDb: tool.touchesRealDb,
      }));
    },
    async execute(toolName: string, rawInput: unknown): Promise<ToolExecutionResult<any>> {
      const tool = toolMap.get(toolName);
      if (!tool) {
        const audit = makeAuditPayload({
          tool_name: toolName,
          permission_level: "read",
          actor,
          payload: { rawInput: rawInput as Record<string, unknown> },
          output_summary: { code: "tool_not_found" },
          dry_run: false,
          status: "failed",
          error_message: `Unknown tool ${toolName}`,
        });
        await auditLogger.log(audit);
        return { ok: false, tool: toolName, permissionLevel: "read", error: { code: "tool_not_found", message: `Unknown tool ${toolName}` }, audit };
      }
      const parsed = tool.inputSchema.safeParse(rawInput ?? {});
      if (!parsed.success) {
        const audit = makeAuditPayload({
          tool_name: tool.name,
          permission_level: tool.permissionLevel,
          actor,
          payload: (rawInput as Record<string, unknown>) ?? {},
          output_summary: { code: "invalid_input" },
          dry_run: false,
          status: "failed",
          error_message: parsed.error.message,
        });
        await auditLogger.log(audit);
        return { ok: false, tool: tool.name, permissionLevel: tool.permissionLevel, error: { code: "invalid_input", message: parsed.error.message }, audit };
      }
      const dryRun = parsed.data && typeof parsed.data === "object" && "dryRun" in parsed.data ? Boolean((parsed.data as { dryRun?: boolean }).dryRun) : false;
      try {
        const data = await tool.execute(parsed.data, { actor });
        const audit = makeAuditPayload({
          tool_name: tool.name,
          permission_level: tool.permissionLevel,
          actor,
          payload: parsed.data as Record<string, unknown>,
          output_summary: summarizeOutput(data),
          dry_run: dryRun,
          status: data && typeof data === "object" && "requires_approval" in data ? "approval_required" : "completed",
        });
        await auditLogger.log(audit);
        return { ok: true, tool: tool.name, permissionLevel: tool.permissionLevel, data, audit };
      } catch (error) {
        const normalized = normalizeError(error);
        const audit = makeAuditPayload({
          tool_name: tool.name,
          permission_level: tool.permissionLevel,
          actor,
          payload: parsed.data as Record<string, unknown>,
          output_summary: { code: normalized.code },
          dry_run: dryRun,
          status: "failed",
          error_message: normalized.message,
        });
        await auditLogger.log(audit);
        return { ok: false, tool: tool.name, permissionLevel: tool.permissionLevel, error: normalized, audit };
      }
    },
  };
}
