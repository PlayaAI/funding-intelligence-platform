import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentAutonomyExecutionClaim,
  AgentAutonomyPolicyRecord,
  AgentAutonomyStore,
  AgentAutonomyUsage,
} from "./autonomyPolicy";

export function createSupabaseAutonomyStore(client: SupabaseClient): AgentAutonomyStore {
  return {
    async resolvePolicy(tokenId: string): Promise<AgentAutonomyPolicyRecord | null> {
      const { data, error } = await client
        .from("agent_autonomy_policies")
        .select("*")
        .eq("token_id", tokenId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as AgentAutonomyPolicyRecord | null;
    },

    async getUsage(tokenId: string): Promise<AgentAutonomyUsage> {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const { count, error } = await client
        .from("agent_autonomy_events")
        .select("id", { count: "exact", head: true })
        .eq("token_id", tokenId)
        .eq("mutation_performed", true)
        .gte("created_at", start.toISOString());
      if (error) throw new Error(error.message);
      return { writesToday: count ?? 0 };
    },

    async claimExecution(input): Promise<AgentAutonomyExecutionClaim> {
      const { data, error } = await client
        .from("agent_autonomy_events")
        .insert({
          policy_id: input.policyId,
          token_id: input.tokenId,
          user_id: input.userId,
          tool_name: input.toolName,
          idempotency_key: input.idempotencyKey,
          status: "claimed",
          mutation_performed: false,
          affected_record_ids: [],
          result_summary: {},
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") return { ok: false, code: "replay_detected", message: "This autonomous request was already claimed. Use a new idempotencyKey only for a genuinely new operation." };
        return { ok: false, code: "autonomy_audit_unavailable", message: "The autonomy execution could not be durably claimed before mutation." };
      }
      return { ok: true, eventId: data.id as string };
    },

    async completeExecution(eventId, input): Promise<void> {
      const { error } = await client
        .from("agent_autonomy_events")
        .update({
          status: input.errorCode ? "failed" : "completed",
          mutation_performed: input.mutationPerformed,
          affected_record_ids: input.affectedRecordIds,
          result_summary: input.resultSummary,
          error_code: input.errorCode ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", eventId)
        .eq("status", "claimed");
      if (error) throw new Error(error.message);
    },
  };
}
