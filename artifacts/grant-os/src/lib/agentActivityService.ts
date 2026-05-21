import { supabase } from "./supabase";
import type { AgentActivityLogInsert, AgentActivityLogRow } from "@/types/database";

export type { AgentActivityLogInsert, AgentActivityLogRow };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listAgentActivity(limit = 100): Promise<AgentActivityLogRow[]> {
  const result: SupabaseResult<AgentActivityLogRow[]> = await db
    .from("agent_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createAgentActivity(
  input: Omit<AgentActivityLogInsert, "id" | "created_at">
): Promise<AgentActivityLogRow> {
  const result: SupabaseResult<AgentActivityLogRow> = await db
    .from("agent_activity_logs")
    .insert(input)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}
