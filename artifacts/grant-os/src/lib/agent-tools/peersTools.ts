import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";
import { buildPeerPacket } from "./builders";
import { makeToolError } from "./safety";

export function createPeerTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_peers",
      description: "List peer organizations.",
      permissionLevel: "read",
      inputSchema: z.object({ limit: z.number().int().positive().max(200).optional() }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Peer intelligence data may be sensitive research material."],
      relatedTables: ["peer_organizations"],
      touchesRealDb: true,
      async execute({ limit }) {
        const peers = await repository.listPeers();
        return { items: limit ? peers.slice(0, limit) : peers, total: peers.length };
      },
    },
    {
      name: "get_peer",
      description: "Get one peer organization.",
      permissionLevel: "read",
      inputSchema: z.object({ peerId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Peer details may include notes, relevance scores, and sources."],
      relatedTables: ["peer_organizations"],
      touchesRealDb: true,
      async execute({ peerId }) {
        const peer = await repository.getPeer(peerId);
        if (!peer) throw makeToolError("peer_not_found", `Peer ${peerId} was not found.`);
        return { peer };
      },
    },
    {
      name: "get_peer_funding_records",
      description: "List funding records for a peer organization.",
      permissionLevel: "read",
      inputSchema: z.object({ peerId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: ["Funding records contain competitive intelligence."],
      relatedTables: ["peer_organizations", "peer_funding_records"],
      touchesRealDb: true,
      async execute({ peerId }) {
        const peer = await repository.getPeer(peerId);
        if (!peer) throw makeToolError("peer_not_found", `Peer ${peerId} was not found.`);
        return { peer, fundingRecords: await repository.listPeerFundingRecords(peer.id) };
      },
    },
    {
      name: "export_peer_packet",
      description: "Export a peer intelligence packet.",
      permissionLevel: "read",
      inputSchema: z.object({ peerId: z.string().min(1) }),
      dryRunSupported: false,
      auditAction: "export_created",
      risks: ["Peer export packets aggregate potentially sensitive research context."],
      relatedTables: ["peer_organizations", "peer_funding_records", "funders"],
      touchesRealDb: true,
      async execute({ peerId }) {
        const peer = await repository.getPeer(peerId);
        if (!peer) throw makeToolError("peer_not_found", `Peer ${peerId} was not found.`);
        return buildPeerPacket(repository, peer);
      },
    },
  ];
}
