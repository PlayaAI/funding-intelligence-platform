import { z } from "zod";
import type { GrantOsRepository } from "./repository";
import type { ToolDefinition } from "./types";

const RISKY_KEYWORDS = [
  "official Burning Man partnership",
  "501(c)(3) confirmed",
  "physical Oracle deployed",
  "completed Collective Awareness Dataset",
  "VIP board confirmed",
  "machine with soul",
  "pure human data",
  "global consciousness",
  "superintelligence born from burners"
];

export function createKnowledgeTools(repository: GrantOsRepository): Array<ToolDefinition<any, any>> {
  return [
    {
      name: "list_agent_knowledge_items",
      description: "List active approved knowledge items the agent should use before matching, drafting, or preparing applications.",
      permissionLevel: "read",
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: [],
      relatedTables: ["agent_knowledge_items"],
      touchesRealDb: true,
      inputSchema: z.object({
        knowledge_type: z.string().optional(),
        category: z.string().optional(),
        priority: z.string().optional(),
        confidence_status: z.string().optional(),
        applies_to: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        include_archived: z.boolean().optional().default(false),
      }),
      async execute(input, ctx) {
        const items = await repository.listAgentKnowledgeItems({
          knowledge_type: input.knowledge_type,
          category: input.category,
          priority: input.priority,
          confidence_status: input.confidence_status,
          include_archived: input.include_archived,
        });
        
        // In a real DB, applies_to and search would be done in DB, 
        // but doing it in memory here for simplicity since applies_to is an array and search is text
        let filtered = items;
        if (input.applies_to) {
          filtered = filtered.filter(i => i.applies_to?.includes(input.applies_to!));
        }
        if (input.search) {
          const q = input.search.toLowerCase();
          filtered = filtered.filter(i => 
            i.title.toLowerCase().includes(q) || 
            i.content.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
          );
        }
        
        // Sort so active + approved are first
        filtered.sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          if (a.confidence_status === "approved" && b.confidence_status !== "approved") return -1;
          if (a.confidence_status !== "approved" && b.confidence_status === "approved") return 1;
          return 0;
        });

        const limited = filtered.slice(0, input.limit);

        return {
          items: limited.map(item => ({
            id: item.id,
            title: item.title,
            category: item.category,
            content: item.content,
            knowledge_type: item.knowledge_type,
            priority: item.priority,
            confidence_status: item.confidence_status,
            applies_to: item.applies_to,
            example: item.example,
            source_label: item.source_label,
            updated_at: item.updated_at,
          })),
          count: limited.length,
          filters_applied: input,
          safety_note: "Use approved active knowledge first. Treat background-only, needs-confirmation, do-not-use, and outdated items carefully."
        };
      },
    },

    {
      name: "get_agent_knowledge_item",
      description: "Fetch one knowledge item by ID for detail.",
      permissionLevel: "read",
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: [],
      relatedTables: ["agent_knowledge_items"],
      touchesRealDb: true,
      inputSchema: z.object({
        item_id: z.string(),
      }),
      async execute(input, ctx) {
        const item = await repository.getAgentKnowledgeItem(input.item_id);
        if (!item) {
          return { error: "Item not found or inaccessible" };
        }
        return {
          item,
          safety_note: `This item has confidence status: ${item.confidence_status}.`
        };
      },
    },

    {
      name: "list_agent_knowledge_proposals",
      description: "Inspect proposed knowledge updates, especially pending review or rejected items.",
      permissionLevel: "read",
      dryRunSupported: false,
      auditAction: "data_reviewed",
      risks: [],
      relatedTables: ["agent_knowledge_updates"],
      touchesRealDb: true,
      inputSchema: z.object({
        status: z.string().optional(),
        proposal_type: z.string().optional(),
        risk_level: z.string().optional(),
        source_type: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
      async execute(input, ctx) {
        const proposals = await repository.listAgentKnowledgeProposals({
          status: input.status,
          proposal_type: input.proposal_type,
          risk_level: input.risk_level,
          source_type: input.source_type,
        });
        
        const limited = proposals.slice(0, input.limit);
        
        return {
          proposals: limited,
          count: limited.length,
          filters_applied: input,
        };
      },
    },

    {
      name: "propose_agent_knowledge_update",
      description: "Propose a knowledge update for Admin review. Does not directly edit active knowledge.",
      permissionLevel: "write_safe",
      dryRunSupported: true,
      auditAction: "manual_entry",
      risks: ["Proposals may contain risky keywords"],
      relatedTables: ["agent_knowledge_updates"],
      touchesRealDb: true,
      inputSchema: z.object({
        proposal_type: z.enum(["add", "edit", "archive", "conflict_alert", "do_not_use_rule", "always_rule", "never_rule"]),
        target_item_id: z.string().optional(),
        title: z.string().min(3),
        category: z.string().min(2),
        proposed_content: z.string().min(10),
        rationale: z.string().optional(),
        risk_level: z.enum(["low", "medium", "high"]).optional(),
        source_type: z.enum(["user_instruction", "agent_observation", "notebooklm", "uploaded_doc", "meeting_note", "grant_review", "manual"]).optional(),
        source_excerpt: z.string().optional(),
        conflict_summary: z.string().optional(),
        dryRun: z.boolean().optional().default(true),
      }),
      async execute(input, ctx) {
        let risk_level = input.risk_level ?? "medium";
        const contentLower = input.proposed_content.toLowerCase();
        
        for (const keyword of RISKY_KEYWORDS) {
          if (contentLower.includes(keyword.toLowerCase())) {
            risk_level = "high";
            break;
          }
        }

        if (input.dryRun) {
          return {
            ok: true,
            dryRun: true,
            mutationPerformed: false,
            planned_action: "create_proposal",
            proposal: {
              ...input,
              risk_level,
              status: "pending_review",
            },
            review_required: true,
            safety_note: "This proposal is not active knowledge until an Admin approves it in the dashboard.",
          };
        }

        const proposal = await repository.proposeAgentKnowledgeUpdate({
          proposal_type: input.proposal_type,
          target_item_id: input.target_item_id,
          title: input.title,
          category: input.category,
          proposed_content: input.proposed_content,
          rationale: input.rationale,
          risk_level,
          source_type: input.source_type,
          source_excerpt: input.source_excerpt,
          conflict_summary: input.conflict_summary,
        });

        try {
          await repository.recordAudit({
            tool_name: "propose_agent_knowledge_update",
            permission_level: "write_safe",
            actor_type: ctx.actor?.type ?? "agent",
            actor_id: ctx.actor?.id,
            status: "completed",
            dry_run: false,
            input: input,
            output_summary: {
              title: proposal.title,
              proposal_type: proposal.proposal_type,
              risk_level: proposal.risk_level,
              source_type: proposal.source_type
            },
            created_at: new Date().toISOString()
          });
        } catch (e) {
          // ignore
        }

        return {
          ok: true,
          dryRun: false,
          mutationPerformed: true,
          proposal,
          review_required: true,
          safety_note: "This proposal is not active knowledge until an Admin approves it in the dashboard.",
        };
      },
    },
  ];
}
