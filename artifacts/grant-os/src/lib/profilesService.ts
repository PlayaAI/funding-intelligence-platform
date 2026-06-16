import { supabase } from "@/lib/supabase";
import type { ProfileRow } from "@/types/database";

export type { ProfileRow };
import { authDebug } from "@/lib/authDebug";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const PROFILE_FETCH_TIMEOUT_MS = 12_000;

function profileFetchErrorMessage(error: { message?: string; code?: string; details?: string }): string {
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";

  if (
    code === "42501" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level security")
  ) {
    return (
      "Profile access blocked by database permissions (RLS). " +
      "Run migration 006_auth_roles_rls.sql and ensure your user has a row in the profiles table."
    );
  }

  if (msg.includes("relation") && msg.includes("profiles") && msg.includes("does not exist")) {
    return "The profiles table does not exist. Run migration 006_auth_roles_rls.sql in Supabase.";
  }

  return error.message ?? "Failed to load profile.";
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  authDebug("profile fetch start", { userId });

  const query = db.from("profiles").select("*").eq("id", userId).maybeSingle();

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Profile request timed out. Check Supabase URL/key and network.")),
      PROFILE_FETCH_TIMEOUT_MS
    );
  });

  const { data, error } = await Promise.race([query, timeout]);

  if (error) {
    authDebug("profile fetch error", { message: error.message, code: error.code });
    throw new Error(profileFetchErrorMessage(error));
  }

  authDebug("profile fetch end", { found: Boolean(data) });
  return data as ProfileRow | null;
}


export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(profileFetchErrorMessage(error));
  return (data ?? []) as ProfileRow[];
}

export async function updateOwnProfile(values: { userId: string; fullName: string | null }): Promise<ProfileRow> {
  const { data, error } = await db
    .from("profiles")
    .update({
      full_name: values.fullName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", values.userId)
    .select("*")
    .single();

  if (error) throw new Error(profileFetchErrorMessage(error));
  return data as ProfileRow;
}
