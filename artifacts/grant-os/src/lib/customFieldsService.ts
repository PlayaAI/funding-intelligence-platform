import { supabase } from "@/lib/supabase";
import type { CustomFieldInsert, CustomFieldRow, CustomFieldUpdate } from "@/types/database";

export type { CustomFieldInsert, CustomFieldRow, CustomFieldUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listCustomFields(): Promise<CustomFieldRow[]> {
  const result: SupabaseResult<CustomFieldRow[]> = await db
    .from("custom_fields")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createCustomField(
  input: Omit<CustomFieldInsert, "id" | "created_at" | "updated_at">
): Promise<CustomFieldRow> {
  const result: SupabaseResult<CustomFieldRow> = await db
    .from("custom_fields")
    .insert(input)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No custom field returned.");
  return result.data;
}

export async function updateCustomField(
  id: string,
  updates: Omit<CustomFieldUpdate, "id" | "created_at">
): Promise<CustomFieldRow> {
  const result: SupabaseResult<CustomFieldRow> = await db
    .from("custom_fields")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No custom field returned.");
  return result.data;
}

export async function archiveCustomField(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db
    .from("custom_fields")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}

export async function deleteCustomField(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("custom_fields").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}
