import { supabase } from "./supabase";
import type { ProofItemRow, ProofItemInsert, ProofItemUpdate } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type GrantOsSupabaseClient = SupabaseClient<Database>;


export type { ProofItemRow, ProofItemInsert, ProofItemUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// Cast supabase to any so we bypass the generic type-inference issue with
// custom Database schemas. The actual runtime behaviour is correct; we
// enforce our own types through explicit return-type annotations.


export async function listProofItems(projectId?: string, client?: GrantOsSupabaseClient): Promise<ProofItemRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  let query = db
    .from("proof_items")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const result: SupabaseResult<ProofItemRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getProofItem(id: string, client?: GrantOsSupabaseClient): Promise<ProofItemRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<ProofItemRow | null> = await db
    .from("proof_items")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function createProofItem(
  input: Omit<ProofItemInsert, "id" | "created_at" | "updated_at">
, client?: GrantOsSupabaseClient): Promise<ProofItemRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<ProofItemRow> = await db
    .from("proof_items")
    .insert(input)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateProofItem(
  id: string,
  updates: Omit<ProofItemUpdate, "id" | "created_at">
, client?: GrantOsSupabaseClient): Promise<ProofItemRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<ProofItemRow> = await db
    .from("proof_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveProofItem(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("proof_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function deleteProofItem(id: string, client?: GrantOsSupabaseClient): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (client ?? supabase) as any;
  const result: SupabaseResult<null> = await db
    .from("proof_items")
    .delete()
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}
