import { supabase } from "@/lib/supabase";
import type {
  AgentMutationApprovalEventRow,
  AgentMutationApprovalRow,
  AgentMutationApprovalStatus,
} from "@/types/database";

async function request(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Log in again to review agent approvals.");
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null) as {
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Approval request failed (${response.status}).`);
  }
  return body as any;
}

export async function listMutationApprovals(status?: AgentMutationApprovalStatus): Promise<{
  approvals: AgentMutationApprovalRow[];
  canApprove: boolean;
}> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const body = await request(`/api/agent/approvals${query}`);
  return { approvals: body.approvals ?? [], canApprove: Boolean(body.canApprove) };
}

export async function getMutationApproval(id: string): Promise<{
  approval: AgentMutationApprovalRow;
  events: AgentMutationApprovalEventRow[];
  canApprove: boolean;
}> {
  return request(`/api/agent/approvals/${encodeURIComponent(id)}`);
}

export async function approveMutationApproval(id: string) {
  return request(`/api/agent/approvals/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: "{}",
  });
}

export async function rejectMutationApproval(id: string, reason: string) {
  return request(`/api/agent/approvals/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function expireMutationApproval(id: string) {
  return request(`/api/agent/approvals/${encodeURIComponent(id)}/expire`, {
    method: "POST",
    body: "{}",
  });
}
