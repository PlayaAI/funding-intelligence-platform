import { supabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrantRow, GrantInsert, GrantUpdate } from "@/types/database";
import type { Database } from "@/types/database";

export type { GrantRow, GrantInsert, GrantUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type GrantOsSupabaseClient = SupabaseClient<Database>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(client?: GrantOsSupabaseClient): any {
  return client ?? db;
}

export type ListGrantsOptions = {
  /** Include rows with archived_at set (soft-archived). Default false. */
  includeSoftArchived?: boolean;
};

export async function listGrants(
  opts?: ListGrantsOptions,
  client?: GrantOsSupabaseClient
): Promise<GrantRow[]> {
  let query = getDb(client).from("grants").select("*").order("deadline", { ascending: true, nullsFirst: false });

  if (!opts?.includeSoftArchived) {
    query = query.is("archived_at", null);
  }

  const result: SupabaseResult<GrantRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getGrantById(
  id: string,
  client?: GrantOsSupabaseClient
): Promise<GrantRow | null> {
  const result: SupabaseResult<GrantRow | null> = await getDb(client)
    .from("grants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function createGrant(
  input: Omit<GrantInsert, "id" | "created_at" | "updated_at">
): Promise<GrantRow> {
  const result: SupabaseResult<GrantRow> = await db.from("grants").insert(input).select().single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateGrant(
  id: string,
  updates: Omit<GrantUpdate, "id" | "created_at">,
  client?: GrantOsSupabaseClient
): Promise<GrantRow> {
  const result: SupabaseResult<GrantRow> = await getDb(client)
    .from("grants")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveGrant(id: string): Promise<void> {
  const now = new Date().toISOString();
  const result: SupabaseResult<null> = await db
    .from("grants")
    .update({
      archived_at: now,
      status: "Archived",
      updated_at: now,
    })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function deleteGrant(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("grants").delete().eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function setGrantTopThree(id: string, isTopThree: boolean): Promise<GrantRow> {
  return updateGrant(id, { is_top_three: isTopThree });
}
