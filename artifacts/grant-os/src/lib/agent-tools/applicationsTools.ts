import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { buildApplicationPacket } from "./builders";
import { makeToolError } from "./safety";

export function createApplicationTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_applications",
      description: "List active applications.",
      permissionLevel: "read",
      inputSchema: z.object({ limit: z.number().int().positive().max(100).optional(), grantId: z.string().optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Applications can contain sensitive internal drafting state."],
      relatedTables: ["applications"],
      touchesRealDb: true,
      async execute({ limit, grantId }) {
        const DEFAULT_LIMIT = 25;
        const cap = Math.min(limit ?? DEFAULT_LIMIT, 100);
        let applications = await repository.listApplications();
        if (grantId) applications = applications.filter((application) => application.grant_id === grantId);
        return { items: applications.slice(0, cap), total: applications.length, limit: cap };
      },
    },
    {
      name: "get_application",
      description: "Get one application by id.",
      permissionLevel: "read",
      inputSchema: z.object({ applicationId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Application detail may include notes and links to private docs."],
      relatedTables: ["applications"],
      touchesRealDb: true,
      async execute({ applicationId }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        return { application };
      },
    },
    {
      name: "get_application_tasks",
      description: "List tasks linked to an application.",
      permissionLevel: "read",
      inputSchema: z.object({ applicationId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Task lists expose operational workload and ownership."],
      relatedTables: ["applications", "tasks"],
      touchesRealDb: true,
      async execute({ applicationId }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        return { application, tasks: await repository.listTasksByApplication(applicationId) };
      },
    },
    {
      name: "get_application_documents",
      description: "List documents linked to an application.",
      permissionLevel: "read",
      inputSchema: z.object({ applicationId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Application documents may expose draft or source content."],
      relatedTables: ["applications", "documents"],
      touchesRealDb: true,
      async execute({ applicationId }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        return { application, documents: await repository.listDocuments({ relatedApplicationId: applicationId }) };
      },
    },
    {
      name: "export_application_packet",
      description: "Export an application workspace packet for internal use.",
      permissionLevel: "read",
      inputSchema: z.object({ applicationId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "export_created",
      risks: ["Application exports aggregate many private records; keep internal only."],
      relatedTables: ["applications", "grants", "funders", "projects", "documents", "tasks", "application_questions", "application_required_documents", "agent_notes", "agent_reports", "grant_matches"],
      touchesRealDb: true,
      async execute({ applicationId }) {
        const application = await repository.getApplication(applicationId);
        if (!application) throw makeToolError("application_not_found", `Application ${applicationId} was not found.`);
        return buildApplicationPacket(repository, application);
      },
    },
  ];
}
