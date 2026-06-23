import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { buildGrantPacket, sortGrantsForSearch } from "./builders";
import { makeToolError } from "./safety";

export function createGrantTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_grants",
      description: "List active grants with optional limit and status filter.",
      permissionLevel: "read",
      inputSchema: z.object({ limit: z.number().int().positive().max(100).optional(), status: z.string().optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["May surface sensitive internal grant notes to authenticated actors."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute(input) {
        const DEFAULT_LIMIT = 25;
        const limit = Math.min(input.limit ?? DEFAULT_LIMIT, 100);
        let grants = await repository.listGrants();
        if (input.status) grants = grants.filter((grant) => grant.status === input.status);
        grants = grants.slice(0, limit);
        return { items: grants, total: grants.length, limit };
      },
    },
    {
      name: "get_grant",
      description: "Fetch one grant by id.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Grant detail may include internal notes and statuses."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ grantId }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        return { grant };
      },
    },
    {
      name: "search_grants",
      description: "Search grants by title, funder name, geography, or focus area.",
      permissionLevel: "read",
      inputSchema: z.object({ query: z.string().min(1), limit: z.number().int().positive().max(100).optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Search can reveal large result sets if used broadly."],
      relatedTables: ["grants"],
      touchesRealDb: true,
      async execute({ query, limit }) {
        const DEFAULT_LIMIT = 25;
        const cap = Math.min(limit ?? DEFAULT_LIMIT, 100);
        const normalized = query.trim().toLowerCase();
        const grants = (await repository.listGrants()).filter((grant) => {
          const haystack = [grant.title, grant.funder_name ?? "", grant.geography ?? "", ...(grant.focus_areas ?? [])]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalized);
        });
        const sorted = sortGrantsForSearch(grants, query);
        return { items: sorted.slice(0, cap), total: sorted.length, query, limit: cap };
      },
    },
    {
      name: "get_grant_documents",
      description: "Fetch documents linked to a grant or its funder.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Documents may include extracted text or sensitive source links."],
      relatedTables: ["grants", "funders", "documents"],
      touchesRealDb: true,
      async execute({ grantId }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const funder = grant.funder_id ? await repository.getFunder(grant.funder_id) : null;
        const documents = await repository.listGrantDocuments(grant, funder);
        return { grant, documents };
      },
    },
    {
      name: "get_grant_applications",
      description: "List applications linked to a grant.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Applications may reveal internal drafting state."],
      relatedTables: ["grants", "applications"],
      touchesRealDb: true,
      async execute({ grantId }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const applications = await repository.listApplicationsByGrant(grantId);
        return { grant, applications };
      },
    },
    {
      name: "export_grant_packet",
      description: "Export a grant-centric packet for AI/human review.",
      permissionLevel: "read",
      inputSchema: z.object({ grantId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "export_created",
      risks: ["Export packets can aggregate many linked records; share internally only."],
      relatedTables: ["grants", "funders", "projects", "applications", "tasks", "documents", "agent_notes", "agent_reports", "grant_matches"],
      touchesRealDb: true,
      async execute({ grantId }) {
        const grant = await repository.getGrant(grantId);
        if (!grant) throw makeToolError("grant_not_found", `Grant ${grantId} was not found.`);
        const funder = grant.funder_id ? await repository.getFunder(grant.funder_id) : null;
        return buildGrantPacket(repository, grant, funder);
      },
    },
  ];
}
