import { supabase } from "./supabase";
import type { AgentNoteInsert, AgentNoteRow, AgentNoteUpdate } from "@/types/database";

export type { AgentNoteInsert, AgentNoteRow, AgentNoteUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type AgentNoteFilters = {
  relatedProjectId?: string;
  relatedGrantId?: string;
  relatedFunderId?: string;
  relatedApplicationId?: string;
  includeArchived?: boolean;
};

export async function listAgentNotes(filters?: AgentNoteFilters): Promise<AgentNoteRow[]> {
  let query = db.from("agent_notes").select("*").order("created_at", { ascending: false });
  if (!filters?.includeArchived) query = query.is("archived_at", null);
  if (filters?.relatedProjectId) query = query.eq("related_project_id", filters.relatedProjectId);
  if (filters?.relatedGrantId) query = query.eq("related_grant_id", filters.relatedGrantId);
  if (filters?.relatedFunderId) query = query.eq("related_funder_id", filters.relatedFunderId);
  if (filters?.relatedApplicationId) query = query.eq("related_application_id", filters.relatedApplicationId);
  const result: SupabaseResult<AgentNoteRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createAgentNote(
  input: Omit<AgentNoteInsert, "id" | "created_at" | "updated_at">
): Promise<AgentNoteRow> {
  const result: SupabaseResult<AgentNoteRow> = await db.from("agent_notes").insert(input).select().single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateAgentNote(
  id: string,
  updates: Omit<AgentNoteUpdate, "id" | "created_at">
): Promise<AgentNoteRow> {
  const result: SupabaseResult<AgentNoteRow> = await db
    .from("agent_notes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveAgentNote(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db
    .from("agent_notes")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteAgentNote(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("agent_notes").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}
