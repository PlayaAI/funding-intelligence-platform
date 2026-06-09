import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const browserEnv = typeof import.meta !== "undefined" ? (import.meta.env as Record<string, string | undefined> | undefined) : undefined;
const nodeEnv = typeof process !== "undefined" ? process.env : undefined;

const rawUrl = browserEnv?.VITE_SUPABASE_URL ?? browserEnv?.NEXT_PUBLIC_SUPABASE_URL ?? nodeEnv?.VITE_SUPABASE_URL ?? nodeEnv?.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = browserEnv?.VITE_SUPABASE_ANON_KEY ?? browserEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? nodeEnv?.VITE_SUPABASE_ANON_KEY ?? nodeEnv?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabaseUrl = rawUrl?.trim();
const supabaseAnonKey = rawKey?.trim();

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
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).\n" +
      "Node-based tooling can also read the same variables from process.env.\n" +
      "See SUPABASE_SETUP.md for instructions."
  );
} else if (!isValidSupabaseUrl) {
  console.error(
    "[Grant OS] Supabase URL appears to be a dashboard URL, not a project API URL.\n" +
      "Got: " + supabaseUrl + "\n" +
      "Expected format: https://xxxxxxxxxxxx.supabase.co\n" +
      "Find the correct URL in: Supabase Dashboard → Settings → API → Project URL"
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
