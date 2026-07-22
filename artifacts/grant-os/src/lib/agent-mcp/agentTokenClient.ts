import { supabase } from "@/lib/supabase";

export type AgentTokenMetadata = {
  id: string;
  label: string;
  token_prefix: string;
  scopes: string[];
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
};

async function request(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Log in again to manage agent tokens.");
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, ...init?.headers },
  });
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? `Token request failed (${response.status}).`);
  return body as any;
}

export async function listAgentTokens(): Promise<AgentTokenMetadata[]> {
  const body = await request("/api/agent/tokens");
  return body.tokens ?? [];
}

export async function createAgentToken(input: { label: string; expiryDays: number; scopes: string[] }) {
  return request("/api/agent/tokens", { method: "POST", body: JSON.stringify(input) }) as Promise<AgentTokenMetadata & { token: string; warning: string }>;
}

export async function revokeAgentToken(id: string): Promise<void> {
  await request(`/api/agent/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
}
