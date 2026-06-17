export interface AgentKnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  status: "active" | "draft" | "archived";
  knowledge_type: string;
  priority: "high" | "medium" | "low";
  confidence_status: "approved" | "needs_confirmation" | "background_only" | "do_not_use" | "outdated";
  applies_to: string[] | null;
  example: string | null;
  source_label: string | null;
  source_url: string | null;
  source_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentKnowledgeUpdate {
  id: string;
  proposal_type: "add" | "edit" | "archive" | "conflict_alert" | "do_not_use_rule" | "always_rule" | "never_rule";
  target_item_id: string | null;
  title: string;
  category: string;
  proposed_content: string;
  rationale: string | null;
  risk_level: "low" | "medium" | "high";
  status: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  source_type: string | null;
  source_excerpt: string | null;
  conflict_summary: string | null;
  reviewer_notes: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Helpers for calling the backend API routes

async function fetchApi(path: string, options?: RequestInit) {
  const token = localStorage.getItem("sb-accessToken") || ""; // We might need to get this properly if using Supabase standard auth
  // Actually, Supabase client handles auth. Let's get the token from Supabase client.
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token || "";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  const body = await res.json();
  if (!res.ok || !body.ok) {
    throw new Error(body?.error?.message || "API request failed");
  }
  return body;
}

// Items

export async function listAgentKnowledgeItems(): Promise<AgentKnowledgeItem[]> {
  const res = await fetchApi("/api/agent-knowledge/items");
  return res.items || [];
}

export async function createAgentKnowledgeItem(
  item: Partial<AgentKnowledgeItem>
): Promise<AgentKnowledgeItem> {
  const res = await fetchApi("/api/agent-knowledge/items", {
    method: "POST",
    body: JSON.stringify(item),
  });
  return res.item;
}

export async function updateAgentKnowledgeItem(
  id: string,
  updates: Partial<AgentKnowledgeItem>
): Promise<AgentKnowledgeItem> {
  const res = await fetchApi(`/api/agent-knowledge/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return res.item;
}

export async function archiveAgentKnowledgeItem(id: string): Promise<void> {
  await fetchApi(`/api/agent-knowledge/items/${id}/archive`, {
    method: "POST",
  });
}

// Proposals

export async function listAgentKnowledgeProposals(): Promise<AgentKnowledgeUpdate[]> {
  const res = await fetchApi("/api/agent-knowledge/proposals");
  return res.proposals || [];
}

export async function proposeAgentKnowledgeUpdate(
  proposal: Partial<AgentKnowledgeUpdate>
): Promise<AgentKnowledgeUpdate> {
  const res = await fetchApi("/api/agent-knowledge/proposals", {
    method: "POST",
    body: JSON.stringify(proposal),
  });
  return res.proposal;
}

export async function approveAgentKnowledgeProposal(id: string): Promise<void> {
  await fetchApi(`/api/agent-knowledge/proposals/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectAgentKnowledgeProposal(
  id: string,
  reviewerNotes?: string
): Promise<void> {
  await fetchApi(`/api/agent-knowledge/proposals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewer_notes: reviewerNotes }),
  });
}
