import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateMutationApprovalInput,
  MutationApprovalRecord,
  MutationApprovalStatus,
  MutationApprovalStore,
} from "./approvalService";

function asApprovalRecord(value: unknown): MutationApprovalRecord {
  return value as MutationApprovalRecord;
}

export function createSupabaseMutationApprovalStore(
  client: SupabaseClient
): MutationApprovalStore {
  async function expireIfNeeded(record: MutationApprovalRecord): Promise<MutationApprovalRecord> {
    if (record.status !== "pending" || new Date(record.expires_at) > new Date()) return record;
    const { data, error } = await client
      .from("agent_mutation_approvals")
      .update({
        status: "expired",
        error_code: "approval_expired",
        error_message: "Approval expired before execution.",
      })
      .eq("id", record.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error || !data) return { ...record, status: "expired" };
    await client.from("agent_mutation_approval_events").insert([{
      approval_id: record.id,
      event_type: "expired",
      actor_type: "server",
      token_id: record.requested_by_token_id,
      user_id: null,
      mutation_performed: false,
      write_disposition: "expired",
      affected_record_ids: record.affected_record_ids,
    }]);
    return asApprovalRecord(data);
  }

  return {
    async create(input: CreateMutationApprovalInput) {
      const { data, error } = await client
        .from("agent_mutation_approvals")
        .insert([{
          requested_by_user_id: input.requestedByUserId,
          requested_by_token_id: input.requestedByTokenId,
          requested_by_agent_label: input.requestedByAgentLabel,
          requested_tool: input.requestedTool,
          requested_action: input.requestedTool,
          request_arguments: input.requestArguments,
          dry_run_payload: input.dryRunPayload,
          planned_mutation: input.plannedMutation,
          payload_hash: input.payloadHash,
          affected_record_ids: input.affectedRecordIds,
          risk_warnings: input.riskWarnings,
          expires_at: input.expiresAt,
        }])
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Mutation approval could not be created.");
      }
      const record = asApprovalRecord(data);
      const { error: eventError } = await client
        .from("agent_mutation_approval_events")
        .insert([{
          approval_id: record.id,
          event_type: "requested",
          actor_type: "mcp_token",
          token_id: record.requested_by_token_id,
          user_id: record.requested_by_user_id,
          mutation_performed: false,
          write_disposition: "approval_requested",
          affected_record_ids: record.affected_record_ids,
          metadata: {
            requested_tool: record.requested_tool,
            payload_hash: record.payload_hash,
            token_prefix_only: true,
          },
        }]);
      if (eventError) {
        throw new Error(`Approval created but audit event failed: ${eventError.message}`);
      }
      return record;
    },
    async getForToken(approvalId: string, tokenId: string) {
      const { data, error } = await client
        .from("agent_mutation_approvals")
        .select("*")
        .eq("id", approvalId)
        .eq("requested_by_token_id", tokenId)
        .maybeSingle();
      if (error || !data) return null;
      return expireIfNeeded(asApprovalRecord(data));
    },
    async listForToken(tokenId: string, statuses?: MutationApprovalStatus[]) {
      let query = client
        .from("agent_mutation_approvals")
        .select("*")
        .eq("requested_by_token_id", tokenId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (statuses?.length) query = query.in("status", statuses);
      const { data, error } = await query;
      if (error || !data) return [];
      return Promise.all(data.map((record) => expireIfNeeded(asApprovalRecord(record))));
    },
  };
}
