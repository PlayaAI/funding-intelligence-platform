import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { filterFundingRecordsForFunder } from "./builders";
import { makeToolError } from "./safety";

export function createFunderTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_funders",
      description: "List active funders.",
      permissionLevel: "read",
      inputSchema: z.object({ limit: z.number().int().positive().max(100).optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Funders may contain private notes or relationship metadata."],
      relatedTables: ["funders"],
      touchesRealDb: true,
      async execute({ limit }) {
        const DEFAULT_LIMIT = 50;
        const cap = Math.min(limit ?? DEFAULT_LIMIT, 100);
        const funders = await repository.listFunders();
        return { items: funders.slice(0, cap), total: funders.length, limit: cap };
      },
    },
    {
      name: "get_funder",
      description: "Get a funder record by id or legacy id.",
      permissionLevel: "read",
      inputSchema: z.object({ funderId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Funder detail may contain contact data."],
      relatedTables: ["funders"],
      touchesRealDb: true,
      async execute({ funderId }) {
        const funder = await repository.getFunder(funderId);
        if (!funder) throw makeToolError("funder_not_found", `Funder ${funderId} was not found.`);
        return { funder };
      },
    },
    {
      name: "get_funder_grants",
      description: "List grants linked to a funder.",
      permissionLevel: "read",
      inputSchema: z.object({ funderId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Grant lists may reveal internal statuses."],
      relatedTables: ["funders", "grants"],
      touchesRealDb: true,
      async execute({ funderId }) {
        const funder = await repository.getFunder(funderId);
        if (!funder) throw makeToolError("funder_not_found", `Funder ${funderId} was not found.`);
        const grants = (await repository.listGrants()).filter((grant) => grant.funder_id === funder.id || grant.funder_name === funder.name);
        return { funder, grants };
      },
    },
    {
      name: "get_funder_peer_intelligence",
      description: "Return peer funding records linked to a funder.",
      permissionLevel: "read",
      inputSchema: z.object({ funderId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Peer intelligence may aggregate sensitive competitive context."],
      relatedTables: ["funders", "peer_funding_records", "peer_organizations"],
      touchesRealDb: true,
      async execute({ funderId }) {
        const funder = await repository.getFunder(funderId);
        if (!funder) throw makeToolError("funder_not_found", `Funder ${funderId} was not found.`);
        const [records, peers] = await Promise.all([repository.listAllPeerFundingRecords(), repository.listPeers()]);
        const fundingRecords = filterFundingRecordsForFunder(records, funder.id);
        const peerIds = new Set(fundingRecords.map((record) => record.peer_organization_id));
        return { funder, fundingRecords, peers: peers.filter((peer) => peerIds.has(peer.id)) };
      },
    },
  ];
}
