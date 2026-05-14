import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabaseUrl = rawUrl?.trim();
const supabaseAnonKey = rawKey?.trim();

// Validate that the URL looks like a real Supabase project URL, not the dashboard URL.
// Correct format: https://xxxxxxxxxxxx.supabase.co
// Common mistake: https://supabase.com/dashboard/...
const isValidSupabaseUrl =
  Boolean(supabaseUrl) &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl ?? "");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseUrlValid = isValidSupabaseUrl;

export type SupabaseConfigError =
  | "missing_vars"
  | "wrong_url_format"
  | null;

export function getSupabaseConfigError(): SupabaseConfigError {
  if (!supabaseUrl || !supabaseAnonKey) return "missing_vars";
  if (!isValidSupabaseUrl) return "wrong_url_format";
  return null;
}

if (!isSupabaseConfigured) {
  console.warn(
    "[Grant OS] Supabase is not configured.\n" +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n" +
      "See SUPABASE_SETUP.md for instructions."
  );
} else if (!isValidSupabaseUrl) {
  console.error(
    "[Grant OS] VITE_SUPABASE_URL appears to be a dashboard URL, not a project API URL.\n" +
      "Got: " + supabaseUrl + "\n" +
      "Expected format: https://xxxxxxxxxxxx.supabase.co\n" +
      "Find the correct URL in: Supabase Dashboard → Settings → API → Project URL"
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key"
);
