import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { filterProjectProofItems } from "./builders";
import { makeToolError } from "./safety";

export function createProjectTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_projects",
      description: "List internal projects.",
      permissionLevel: "read",
      inputSchema: z.object({ limit: z.number().int().positive().max(200).optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Projects may include internal strategy fields."],
      relatedTables: ["projects"],
      touchesRealDb: true,
      async execute({ limit }) {
        const projects = await repository.listProjects();
        return { items: limit ? projects.slice(0, limit) : projects, total: projects.length };
      },
    },
    {
      name: "get_project",
      description: "Get a project by id or slug.",
      permissionLevel: "read",
      inputSchema: z.object({ projectId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Project detail may reveal private roadmap info."],
      relatedTables: ["projects"],
      touchesRealDb: true,
      async execute({ projectId }) {
        const project = await repository.getProject(projectId);
        if (!project) throw makeToolError("project_not_found", `Project ${projectId} was not found.`);
        return { project };
      },
    },
    {
      name: "list_proof_items",
      description: "List proof items with optional project filter.",
      permissionLevel: "read",
      inputSchema: z.object({ projectId: z.string().optional(), limit: z.number().int().positive().max(200).optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Proof items may include private documents or metrics references."],
      relatedTables: ["proof_items"],
      touchesRealDb: true,
      async execute({ projectId, limit }) {
        const items = await repository.listProofItems(projectId);
        return { items: limit ? items.slice(0, limit) : items, total: items.length };
      },
    },
    {
      name: "get_proof_items_for_project",
      description: "List proof items for a specific project.",
      permissionLevel: "read",
      inputSchema: z.object({ projectId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Proof item collections may expose internal evidence inventory."],
      relatedTables: ["projects", "proof_items"],
      touchesRealDb: true,
      async execute({ projectId }) {
        const project = await repository.getProject(projectId);
        if (!project) throw makeToolError("project_not_found", `Project ${projectId} was not found.`);
        const proofItems = filterProjectProofItems(project.id, await repository.listProofItems(project.id));
        return { project, proofItems };
      },
    },
  ];
}
