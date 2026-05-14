import { supabase } from "./supabase";
import type { ProjectRow, ProjectInsert, ProjectUpdate } from "@/types/database";

export type { ProjectRow, ProjectInsert, ProjectUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// Cast supabase to any so we bypass the generic type-inference issue with
// custom Database schemas. The actual runtime behaviour is correct; we
// enforce our own types through explicit return-type annotations.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listProjects(): Promise<ProjectRow[]> {
  const result: SupabaseResult<ProjectRow[]> = await db
    .from("projects")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getProjectBySlug(slug: string): Promise<ProjectRow | null> {
  const result: SupabaseResult<ProjectRow | null> = await db
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function createProject(
  input: Omit<ProjectInsert, "id" | "created_at" | "updated_at">
): Promise<ProjectRow> {
  const result: SupabaseResult<ProjectRow> = await db
    .from("projects")
    .insert(input)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateProject(
  slug: string,
  updates: Omit<ProjectUpdate, "id" | "slug" | "created_at">
): Promise<ProjectRow> {
  const result: SupabaseResult<ProjectRow> = await db
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("slug", slug)
    .is("archived_at", null)
    .select()
    .single();

  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveProject(slug: string): Promise<void> {
  const result: SupabaseResult<null> = await db
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("slug", slug);

  if (result.error) throw new Error(result.error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db
    .from("projects")
    .delete()
    .eq("id", id);

  if (result.error) throw new Error(result.error.message);
}
