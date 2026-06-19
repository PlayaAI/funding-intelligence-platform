import { supabase } from "./supabase";
import type { Json } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type GrantOsSupabaseClient = SupabaseClient<Database>;


export type GrantShortlistStatus = "New" | "Watching" | "Shortlisted" | "Apply" | "Skip" | "Archived" | "Not relevant";
export type GrantShortlistPriority = "Low" | "Medium" | "High" | "Urgent";

export interface GrantShortlistItemRow {
  id: string;
  grant_id: string;
  project_id: string | null;
  status: GrantShortlistStatus;
  priority: GrantShortlistPriority;
  owner_name: string | null;
  next_action: string | null;
  notes: string | null;
  saved_at: string;
  due_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GrantShortlistItemInsert = {
  id?: string;
  grant_id: string;
  project_id?: string | null;
  status?: GrantShortlistStatus;
  priority?: GrantShortlistPriority;
  owner_name?: string | null;
  next_action?: string | null;
  notes?: string | null;
  saved_at?: string;
  due_date?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GrantShortlistItemUpdate = Partial<GrantShortlistItemInsert>;

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string; code?: string; details?: string } };



function isMissingShortlistTable(error: { message: string; code?: string }) {
  return error.code === "42P01" || /grant_shortlist_items/i.test(error.message) && /does not exist|schema cache/i.test(error.message);
}

export async function listGrantShortlistItems(client?: GrantOsSupabaseClient): Promise<GrantShortlistItemRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<GrantShortlistItemRow[]> = await db
    .from("grant_shortlist_items")
    .select("*")
    .is("archived_at", null)
    .order("saved_at", { ascending: false });

  if (result.error) {
    if (isMissingShortlistTable(result.error)) return [];
    throw new Error(result.error.message);
  }
  return result.data ?? [];
}

export async function upsertGrantShortlistItem(input: GrantShortlistItemInsert, client?: GrantOsSupabaseClient): Promise<GrantShortlistItemRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  // Avoid relying on PostgreSQL unique handling for nullable project_id.
  // Null project scopes are common in the current UI and UNIQUE(grant_id, project_id)
  // would otherwise allow duplicate global shortlist rows.
  let existingQuery = db
    .from("grant_shortlist_items")
    .select("id")
    .eq("grant_id", input.grant_id)
    .is("archived_at", null)
    .limit(1);

  existingQuery = input.project_id ? existingQuery.eq("project_id", input.project_id) : existingQuery.is("project_id", null);
  const existing: SupabaseResult<Array<{ id: string }>> = await existingQuery;
  if (existing.error) throw new Error(existing.error.message);

  const existingId = existing.data?.[0]?.id;
  const result: SupabaseResult<GrantShortlistItemRow> = existingId
    ? await db.from("grant_shortlist_items").update(input).eq("id", existingId).select().single()
    : await db.from("grant_shortlist_items").insert(input).select().single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No shortlist item returned");
  return result.data;
}

export async function archiveGrantShortlistItem(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<Json> = await db
    .from("grant_shortlist_items")
    .update({ archived_at: new Date().toISOString(), status: "Archived" })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}
