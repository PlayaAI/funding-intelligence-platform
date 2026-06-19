import { supabase } from "./supabase";
import type { AgentReportInsert, AgentReportRow, AgentReportUpdate } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type GrantOsSupabaseClient = SupabaseClient<Database>;


export type { AgentReportInsert, AgentReportRow, AgentReportUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };



export type AgentReportFilters = {
  relatedProjectId?: string;
  relatedGrantId?: string;
  relatedApplicationId?: string;
  includeArchived?: boolean;
};

export async function listAgentReports(filters?: AgentReportFilters, client?: GrantOsSupabaseClient): Promise<AgentReportRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  let query = db.from("agent_reports").select("*").order("created_at", { ascending: false });
  if (!filters?.includeArchived) query = query.is("archived_at", null);
  if (filters?.relatedProjectId) query = query.eq("related_project_id", filters.relatedProjectId);
  if (filters?.relatedGrantId) query = query.eq("related_grant_id", filters.relatedGrantId);
  if (filters?.relatedApplicationId) query = query.eq("related_application_id", filters.relatedApplicationId);
  const result: SupabaseResult<AgentReportRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createAgentReport(
  input: Omit<AgentReportInsert, "id" | "created_at" | "updated_at">
, client?: GrantOsSupabaseClient): Promise<AgentReportRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<AgentReportRow> = await db.from("agent_reports").insert(input).select().single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateAgentReport(
  id: string,
  updates: Omit<AgentReportUpdate, "id" | "created_at">
, client?: GrantOsSupabaseClient): Promise<AgentReportRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<AgentReportRow> = await db
    .from("agent_reports")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveAgentReport(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("agent_reports")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (result.error) throw new Error(result.error.message);
}
