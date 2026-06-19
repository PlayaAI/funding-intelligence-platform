import { supabase } from "./supabase";
import type { FunderInsert, FunderRow, FunderUpdate } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type GrantOsSupabaseClient = SupabaseClient<Database>;


export type { FunderRow, FunderInsert, FunderUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };



const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listFunders(client?: GrantOsSupabaseClient): Promise<FunderRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<FunderRow[]> = await db
    .from("funders")
    .select("*")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getFunderByIdOrLegacy(id: string, client?: GrantOsSupabaseClient): Promise<FunderRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  if (UUID_RE.test(id)) {
    const result: SupabaseResult<FunderRow | null> = await db
      .from("funders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }

  const result: SupabaseResult<FunderRow | null> = await db
    .from("funders")
    .select("*")
    .eq("legacy_id", id)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function createFunder(
  input: Omit<FunderInsert, "id" | "created_at" | "updated_at">
, client?: GrantOsSupabaseClient): Promise<FunderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<FunderRow> = await db.from("funders").insert(input).select().single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateFunder(
  id: string,
  updates: Omit<FunderUpdate, "id" | "created_at">
, client?: GrantOsSupabaseClient): Promise<FunderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<FunderRow> = await db
    .from("funders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveFunder(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("funders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function deleteFunder(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db.from("funders").delete().eq("id", id);

  if (result.error) throw new Error(result.error.message);
}
