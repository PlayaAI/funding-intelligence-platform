import { supabase } from "./supabase";
import type { TaskRow, TaskInsert, TaskUpdate } from "@/types/database";

export type { TaskRow, TaskInsert, TaskUpdate };

type SupabaseResult<T> = { data: T; error: null } | { data: null; error: { message: string } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ListTasksOptions = {
  includeSoftArchived?: boolean;
};

export async function listTasks(opts?: ListTasksOptions): Promise<TaskRow[]> {
  let query = db.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
  if (!opts?.includeSoftArchived) {
    query = query.is("archived_at", null);
  }
  const result: SupabaseResult<TaskRow[]> = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function getTaskById(id: string): Promise<TaskRow | null> {
  const result: SupabaseResult<TaskRow | null> = await db
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listTasksByGrant(grantId: string): Promise<TaskRow[]> {
  const result: SupabaseResult<TaskRow[]> = await db
    .from("tasks")
    .select("*")
    .eq("related_grant_id", grantId)
    .is("archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function listTasksByProject(projectId: string): Promise<TaskRow[]> {
  const result: SupabaseResult<TaskRow[]> = await db
    .from("tasks")
    .select("*")
    .eq("related_project_id", projectId)
    .is("archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function listTasksByApplication(applicationId: string): Promise<TaskRow[]> {
  const result: SupabaseResult<TaskRow[]> = await db
    .from("tasks")
    .select("*")
    .eq("related_application_id", applicationId)
    .is("archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function createTask(
  input: Omit<TaskInsert, "id" | "created_at" | "updated_at">
): Promise<TaskRow> {
  const result: SupabaseResult<TaskRow> = await db.from("tasks").insert(input).select().single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from insert");
  return result.data;
}

export async function updateTask(
  id: string,
  updates: Omit<TaskUpdate, "id" | "created_at">
): Promise<TaskRow> {
  const result: SupabaseResult<TaskRow> = await db
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("No data returned from update");
  return result.data;
}

export async function archiveTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  const result: SupabaseResult<null> = await db
    .from("tasks")
    .update({ archived_at: now, status: "Archived", updated_at: now })
    .eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function deleteTask(id: string): Promise<void> {
  const result: SupabaseResult<null> = await db.from("tasks").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}
