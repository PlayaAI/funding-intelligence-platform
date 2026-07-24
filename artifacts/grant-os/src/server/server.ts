import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createAgentApi } from "../lib/agent-api/agentApi";
import { createMcpAdapter } from "../lib/agent-mcp/adapter";
import {
  generateAgentToken,
  hashAgentToken,
  normaliseScopes,
  type AgentTokenRecord,
} from "../lib/agent-mcp/agentTokenService";
import { createSupabaseMutationApprovalStore } from "../lib/agent-mcp/supabaseApprovalStore";
import {
  APPROVABLE_TOOL_NAMES,
  buildPayloadHashMismatchResponse,
  verifyMutationApprovalPayload,
  type MutationApprovalRecord,
} from "../lib/agent-mcp/approvalService";
import { createLiveGrantOsRepository } from "../lib/agent-tools/repository";
import { createToolRegistry } from "../lib/agent-tools/registry";
import type { AgentAuthContext } from "../lib/agent-tools/authContext";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const distPublic = path.resolve(root, "dist/public");
const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const isProduction = process.env.NODE_ENV === "production";
const supabaseUrl = (
  process.env.VITE_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ""
).trim();
const supabaseAnonKey = (
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  ""
).trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const approvalServiceClient = supabaseServiceRoleKey && supabaseUrl
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;
const mutationApprovalStore = approvalServiceClient
  ? createSupabaseMutationApprovalStore(approvalServiceClient)
  : undefined;

const agentApi = createAgentApi();

// ── MCP Adapter (V2.11H): wire real DB resolvers for agent tokens ─────────
// These closures are defined at startup. resolveAgentToken and updateAgentTokenLastUsed
// use the service-role client to look up / update token records — the ONLY use
// of the service-role key on this path, gated behind all auth + scope checks.
async function resolveAgentToken(hash: string): Promise<AgentTokenRecord | null> {
  if (!supabaseServiceRoleKey || !supabaseUrl) return null;
  const srClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await srClient
    .from("agent_mcp_tokens")
    .select("id,user_id,scopes,expires_at,revoked_at,label,token_prefix,created_at,last_used_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  return data as AgentTokenRecord;
}

async function updateAgentTokenLastUsed(id: string): Promise<void> {
  if (!supabaseServiceRoleKey || !supabaseUrl) return;
  const srClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  await srClient
    .from("agent_mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
}

const mcpAdapter = createMcpAdapter({
  resolveAgentToken,
  updateAgentTokenLastUsed,
  serviceRoleKey: supabaseServiceRoleKey || null,
  approvalStore: mutationApprovalStore,
});

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}


function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function jsonError(status: number, code: string, message: string) {
  return {
    status,
    body: {
      ok: false,
      error: { code, message },
    },
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function bearerTokenFrom(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * V2.11H: Returns true if the request carries a gos_mcp_* agent token.
 * Used to short-circuit non-MCP routes before they reach getAuthenticatedProfile().
 */
function requestHasAgentToken(request: IncomingMessage): boolean {
  const token = bearerTokenFrom(request);
  return token?.startsWith("gos_mcp_") ?? false;
}


async function getAuthenticatedProfile(request: IncomingMessage, useServiceRole: boolean) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError(500, "supabase_not_configured", "Supabase URL or anon key is not configured on the server.");
  }

  const accessToken = bearerTokenFrom(request);
  if (!accessToken) {
    return jsonError(401, "missing_token", "Sign in before inviting teammates.");
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonError(401, "invalid_token", "Sign in again before inviting teammates.");
  }

  const profileClient = useServiceRole
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

  const { data: profile, error: profileError } = await profileClient
    .from("profiles")
    .select("id,email,full_name,role,access_status")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return jsonError(403, "profile_unavailable", "Unable to verify your team role.");
  }
  if (!profile) {
    return jsonError(403, "profile_missing", "No profile row exists for this user.");
  }

  return { status: 200, body: { ok: true, user: userData.user, profile } };
}

async function handleAdminUsers(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/admin/users")) return false;

  const hasServiceRole = Boolean(supabaseServiceRoleKey);
  const authResult = await getAuthenticatedProfile(request, hasServiceRole);
  if (!authResult.body.ok || !("profile" in authResult.body)) {
    sendJson(response, authResult.status, authResult.body);
    return true;
  }

  const profile = authResult.body.profile as { role?: string; access_status?: string };
  if (profile.access_status !== "approved" || profile.role !== "Admin") {
    sendJson(response, 403, {
      ok: false,
      error: { code: "admin_required", message: "Only approved admins can perform this action." },
    });
    return true;
  }

  const adminClient = createClient(supabaseUrl, hasServiceRole ? supabaseServiceRoleKey : supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(hasServiceRole ? {} : { global: { headers: { Authorization: `Bearer ${bearerTokenFrom(request)}` } } }),
  });

  if (request.method === "GET" && url.pathname === "/api/admin/users") {
    // GET all profiles
    const { data, error } = await adminClient.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) {
      sendJson(response, 500, { ok: false, error: { code: "fetch_error", message: error.message } });
      return true;
    }
    sendJson(response, 200, { ok: true, users: data });
    return true;
  }

  if (request.method === "POST") {
    const action = url.pathname.split("/").pop();
    const body = await readJsonBody(request);
    if (!isRecord(body) || typeof body.userId !== "string") {
      sendJson(response, 400, { ok: false, error: { code: "invalid_body", message: "Request body must include userId." } });
      return true;
    }

    const userId = body.userId;

    if (action === "delete") {
      if (!hasServiceRole) {
        sendJson(response, 501, { ok: false, error: { code: "service_role_required", message: "Deleting users requires the SUPABASE_SERVICE_ROLE_KEY." } });
        return true;
      }

      // Prevent deleting the only admin
      const { data: admins } = await adminClient.from("profiles").select("id").eq("role", "Admin").eq("access_status", "approved");
      if (admins && admins.length === 1 && admins[0].id === userId) {
        sendJson(response, 403, { ok: false, error: { code: "cannot_delete_last_admin", message: "Cannot delete the last approved admin." } });
        return true;
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        sendJson(response, 500, { ok: false, error: { code: "delete_failed", message: deleteError.message } });
        return true;
      }
      sendJson(response, 200, { ok: true, message: "User deleted successfully." });
      return true;
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (action === "approve") {
      updates.access_status = "approved";
      updates.approved_at = new Date().toISOString();
      updates.approved_by = authResult.body.user?.id;
    } else if (action === "reject") {
      updates.access_status = "rejected";
      updates.rejected_at = new Date().toISOString();
      updates.rejected_by = authResult.body.user?.id;
    } else if (action === "disable") {
      // Prevent disabling the only admin
      const { data: admins } = await adminClient.from("profiles").select("id").eq("role", "Admin").eq("access_status", "approved");
      if (admins && admins.length === 1 && admins[0].id === userId) {
        sendJson(response, 403, { ok: false, error: { code: "cannot_disable_last_admin", message: "Cannot disable the last approved admin." } });
        return true;
      }
      updates.access_status = "disabled";
      updates.disabled_at = new Date().toISOString();
      updates.disabled_by = authResult.body.user?.id;
    } else if (action === "enable") {
      updates.access_status = "approved";
      updates.approved_at = new Date().toISOString();
      updates.approved_by = authResult.body.user?.id;
    } else if (action === "update-role") {
      if (typeof body.role !== "string" || !["Admin", "Viewer", "Grant Lead", "Contributor"].includes(body.role)) {
        sendJson(response, 400, { ok: false, error: { code: "invalid_role", message: "Invalid role specified." } });
        return true;
      }
      // Prevent demoting the only admin
      if (body.role !== "Admin") {
        const { data: admins } = await adminClient.from("profiles").select("id").eq("role", "Admin").eq("access_status", "approved");
        if (admins && admins.length === 1 && admins[0].id === userId) {
          sendJson(response, 403, { ok: false, error: { code: "cannot_demote_last_admin", message: "Cannot demote the last approved admin." } });
          return true;
        }
      }
      updates.role = body.role;
    } else {
      sendJson(response, 404, { ok: false, error: { code: "invalid_action", message: "Action not found." } });
      return true;
    }

    const { error: updateError } = await adminClient.from("profiles").update(updates).eq("id", userId);
    if (updateError) {
      sendJson(response, 500, { ok: false, error: { code: "update_failed", message: updateError.message } });
      return true;
    }

    sendJson(response, 200, { ok: true, message: `Action ${action} completed successfully.` });
    return true;
  }

  sendJson(response, 405, { ok: false, error: { code: "method_not_allowed", message: "Method not allowed." } });
  return true;
}

async function handleTeamInvite(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api/team/invite") return false;

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: { code: "method_not_allowed", message: "Use POST for teammate invites." } });
    return true;
  }

  try {
    const hasServiceRole = Boolean(supabaseServiceRoleKey);
    const authResult = await getAuthenticatedProfile(request, hasServiceRole);
    if (!authResult.body.ok || !("profile" in authResult.body)) {
      sendJson(response, authResult.status, authResult.body);
      return true;
    }

    const profile = authResult.body.profile as { role?: string; access_status?: string };
    if (profile.access_status !== "approved" || profile.role !== "Admin") {
      sendJson(response, 403, {
        ok: false,
        error: { code: "admin_required", message: "Only approved admins can invite teammates." },
      });
      return true;
    }

    if (!hasServiceRole) {
      sendJson(response, 501, {
        ok: false,
        error: {
          code: "admin_credentials_missing",
          message: "Invite sending is not configured because server-side Supabase admin credentials are missing. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
        },
      });
      return true;
    }

    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      sendJson(response, 400, { ok: false, error: { code: "invalid_body", message: "Invite request body must be a JSON object." } });
      return true;
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role === "Admin" || body.role === "Viewer" ? body.role : null;
    const projectAccess = body.projectAccess === "all" ? "all" : null;

    if (!name) {
      sendJson(response, 400, { ok: false, error: { code: "name_required", message: "Name is required." } });
      return true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(response, 400, { ok: false, error: { code: "invalid_email", message: "Enter a valid email address." } });
      return true;
    }
    if (!role) {
      sendJson(response, 400, { ok: false, error: { code: "invalid_role", message: "Role must be Admin or Viewer." } });
      return true;
    }
    if (projectAccess !== "all") {
      sendJson(response, 400, { ok: false, error: { code: "invalid_project_access", message: "Project access must be All projects." } });
      return true;
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
    });
    if (inviteError || !inviteData.user) {
      sendJson(response, 400, {
        ok: false,
        error: {
          code: "invite_failed",
          message: inviteError?.message ?? "Supabase did not return an invited user.",
        },
      });
      return true;
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: inviteData.user.id,
        email,
        full_name: name,
        role,
        access_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: authResult.body.user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (profileError) {
      sendJson(response, 500, {
        ok: false,
        error: { code: "profile_upsert_failed", message: profileError.message },
      });
      return true;
    }

    sendJson(response, 200, {
      ok: true,
      user: {
        id: inviteData.user.id,
        email,
        role,
        projectAccess: "all",
      },
    });
    return true;
  } catch {
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "Team invite request failed." },
    });
    return true;
  }
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const normalizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const candidatePath = path.resolve(distPublic, `.${normalizedPath}`);
  const candidateIsFile =
    candidatePath.startsWith(distPublic) &&
    existsSync(candidatePath) &&
    statSync(candidatePath).isFile();
  const filePath =
    candidateIsFile
      ? candidatePath
      : path.resolve(distPublic, "index.html");

  response.writeHead(200, { "content-type": contentTypeFor(filePath) });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end("Failed to read Grant OS asset.");
  });
  stream.pipe(response);
}

async function handleAgentKnowledge(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/agent-knowledge/")) return false;

  const hasServiceRole = Boolean(supabaseServiceRoleKey);
  const authResult = await getAuthenticatedProfile(request, hasServiceRole);
  if (!authResult.body.ok || !("profile" in authResult.body)) {
    sendJson(response, authResult.status, authResult.body);
    return true;
  }

  const profile = authResult.body.profile as { role?: string; access_status?: string };
  if (profile.access_status !== "approved") {
    sendJson(response, 403, {
      ok: false,
      error: { code: "not_approved", message: "Only approved users can access agent knowledge." },
    });
    return true;
  }

  const isAdmin = profile.role === "Admin";

  // Use the user's token so RLS applies if we don't use service role
  const client = createClient(supabaseUrl, hasServiceRole ? supabaseServiceRoleKey : supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(hasServiceRole ? {} : { global: { headers: { Authorization: `Bearer ${bearerTokenFrom(request)}` } } }),
  });

  const pathParts = url.pathname.split("/").filter(Boolean); // ['api', 'agent-knowledge', 'items'...]
  const resource = pathParts[2]; // 'items' or 'proposals'
  const id = pathParts[3];
  const action = pathParts[4]; // 'archive', 'approve', 'reject'

  if (resource === "items") {
    if (request.method === "GET" && !id) {
      const { data, error } = await client.from("agent_knowledge_items").select("*").order("created_at", { ascending: false });
      if (error) return sendJson(response, 500, { ok: false, error }), true;
      return sendJson(response, 200, { ok: true, items: data }), true;
    }

    if (request.method === "POST" && !id) {
      if (!isAdmin) return sendJson(response, 403, { ok: false, error: { message: "Admin required" } }), true;
      const body = await readJsonBody(request);
      const { data, error } = await client.from("agent_knowledge_items").insert([{ ...body as any, created_by: authResult.body.user?.id }]).select().single();
      if (error) return sendJson(response, 500, { ok: false, error }), true;
      return sendJson(response, 200, { ok: true, item: data }), true;
    }

    if (request.method === "PATCH" && id && !action) {
      if (!isAdmin) return sendJson(response, 403, { ok: false, error: { message: "Admin required" } }), true;
      const body = await readJsonBody(request);
      const { data, error } = await client.from("agent_knowledge_items").update({ ...body as any, updated_by: authResult.body.user?.id }).eq("id", id).select().single();
      if (error) return sendJson(response, 500, { ok: false, error }), true;
      return sendJson(response, 200, { ok: true, item: data }), true;
    }

    if (request.method === "POST" && id && action === "archive") {
      if (!isAdmin) return sendJson(response, 403, { ok: false, error: { message: "Admin required" } }), true;
      const { data, error } = await client.from("agent_knowledge_items").update({ status: "archived", updated_by: authResult.body.user?.id }).eq("id", id).select().single();
      if (error) return sendJson(response, 500, { ok: false, error }), true;
      return sendJson(response, 200, { ok: true, item: data }), true;
    }
  }

  if (resource === "proposals") {
    if (request.method === "GET" && !id) {
      const { data, error } = await client.from("agent_knowledge_updates").select("*").order("created_at", { ascending: false });
      if (error) return sendJson(response, 500, { ok: false, error }), true;
      return sendJson(response, 200, { ok: true, proposals: data }), true;
    }

    if (request.method === "POST" && !id) {
      const body = await readJsonBody(request);
      const { data, error } = await client.from("agent_knowledge_updates").insert([{ ...body as any, created_by: authResult.body.user?.id }]).select().single();
      if (error) return sendJson(response, 500, { ok: false, error }), true;
      return sendJson(response, 200, { ok: true, proposal: data }), true;
    }

    if (request.method === "POST" && id && action === "approve") {
      if (!isAdmin) return sendJson(response, 403, { ok: false, error: { message: "Admin required" } }), true;

      const { data: proposal, error: fetchError } = await client.from("agent_knowledge_updates").select("*").eq("id", id).single();
      if (fetchError || !proposal) return sendJson(response, 404, { ok: false, error: { message: "Proposal not found" } }), true;

      if (proposal.status !== "pending_review") {
        return sendJson(response, 400, { ok: false, error: { message: `Proposal cannot be approved because its status is ${proposal.status}` } }), true;
      }

      const proposalType = proposal.proposal_type;
      let targetItemId = proposal.target_item_id;

      if (proposalType === "edit" || proposalType === "archive") {
        if (!targetItemId) {
          return sendJson(response, 400, { ok: false, error: { message: `${proposalType} requires a target_item_id` } }), true;
        }
        const { data: existingItem, error: existingError } = await client.from("agent_knowledge_items").select("id").eq("id", targetItemId).single();
        if (existingError || !existingItem) {
          return sendJson(response, 404, { ok: false, error: { message: "Target item not found" } }), true;
        }
      }

      if (!proposal.proposed_content?.trim() && proposalType !== "archive") {
        return sendJson(response, 400, { ok: false, error: { message: "Proposal content is empty" } }), true;
      }

      let knowledgeType = "custom_instruction";
      if (proposalType === "never_rule" || proposalType === "do_not_use_rule") {
        knowledgeType = "do_not_use";
      }

      if (proposalType === "edit") {
        const { error: updateError } = await client.from("agent_knowledge_items").update({
          content: proposal.proposed_content,
          updated_by: authResult.body.user?.id
        }).eq("id", targetItemId);
        if (updateError) return sendJson(response, 500, { ok: false, error: updateError }), true;
      } else if (proposalType === "archive") {
        const { error: updateError } = await client.from("agent_knowledge_items").update({
          status: "archived",
          updated_by: authResult.body.user?.id
        }).eq("id", targetItemId);
        if (updateError) return sendJson(response, 500, { ok: false, error: updateError }), true;
      } else if (proposalType === "conflict_alert" && !targetItemId) {
        // Do nothing to active items, just mark proposal approved
      } else {
        const { data: newItem, error: insertError } = await client.from("agent_knowledge_items").insert([{
          title: proposal.title,
          category: proposal.category,
          content: proposal.proposed_content,
          knowledge_type: knowledgeType,
          priority: "medium",
          status: "active",
          created_by: authResult.body.user?.id,
          source_label: proposal.source_type,
        }]).select("id").single();
        if (insertError) return sendJson(response, 500, { ok: false, error: insertError }), true;
        targetItemId = newItem.id;
      }

      const { error: propUpdateError } = await client.from("agent_knowledge_updates").update({
        status: "approved",
        target_item_id: targetItemId,
        reviewed_by: authResult.body.user?.id,
        reviewed_at: new Date().toISOString()
      }).eq("id", id);
      if (propUpdateError) return sendJson(response, 500, { ok: false, error: propUpdateError }), true;

      return sendJson(response, 200, { ok: true }), true;
    }

    if (request.method === "POST" && id && action === "reject") {
      if (!isAdmin) return sendJson(response, 403, { ok: false, error: { message: "Admin required" } }), true;

      const { data: proposal, error: fetchError } = await client.from("agent_knowledge_updates").select("status").eq("id", id).single();
      if (fetchError || !proposal) return sendJson(response, 404, { ok: false, error: { message: "Proposal not found" } }), true;
      if (proposal.status !== "pending_review") {
        return sendJson(response, 400, { ok: false, error: { message: `Proposal cannot be rejected because its status is ${proposal.status}` } }), true;
      }

      const body = await readJsonBody(request) as any;
      const { error: propUpdateError } = await client.from("agent_knowledge_updates").update({
        status: "rejected",
        reviewer_notes: body.reviewer_notes,
        reviewed_by: authResult.body.user?.id,
        reviewed_at: new Date().toISOString()
      }).eq("id", id);
      if (propUpdateError) return sendJson(response, 500, { ok: false, error: propUpdateError }), true;

      return sendJson(response, 200, { ok: true }), true;
    }
  }

  return sendJson(response, 404, { ok: false, error: { message: "Route not found" } }), true;
}

function approvalApiView(record: MutationApprovalRecord) {
  const { execution_nonce: _executionNonce, ...safe } = record;
  return safe;
}

function approvalErrorCode(message: string | undefined): string {
  if (message?.includes("approval_payload_changed")) return "payload_hash_mismatch";
  const known = [
    "approval_forbidden",
    "approval_not_found",
    "approval_not_pending",
    "approval_expired",
    "approval_nonce_invalid",
    "approval_token_inactive",
    "approval_token_inactive_or_scope_changed",
    "approval_tool_unsupported",
    "approval_execution_not_owned",
  ];
  return known.find((code) => message?.includes(code)) ?? "approval_operation_failed";
}

function approvalErrorMessage(code: string, fallback: string): string {
  if (code === "payload_hash_mismatch") {
    return "The current mutation plan differs from the approved preview. Request a new approval before writing.";
  }
  if (code === "approval_expired") return "This approval expired. Request a new approval.";
  if (code === "approval_not_pending") return "This approval is no longer pending and cannot be executed.";
  if (code === "approval_nonce_invalid") return "This approval failed replay protection and cannot be executed.";
  if (code === "approval_token_inactive_or_scope_changed" || code === "approval_token_inactive") {
    return "The requesting token is revoked, expired, or no longer has the required scope.";
  }
  return fallback;
}

// Delegated approval routes require a normal Supabase user JWT. Operational
// writes execute with that JWT through the existing repository, so table RLS
// remains authoritative. Opaque gos_mcp_* tokens cannot call these routes.
async function handleAgentApprovals(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/agent/approvals")) return false;

  if (requestHasAgentToken(request)) {
    sendJson(response, 401, {
      ok: false,
      error: {
        code: "agent_token_not_allowed",
        message: "Opaque tokens may request and poll approvals through MCP, but only an authenticated dashboard user may approve or execute them.",
      },
    });
    return true;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    sendJson(response, 500, { ok: false, error: { code: "supabase_not_configured", message: "Supabase is not configured." } });
    return true;
  }

  const authResult = await getAuthenticatedProfile(request, false);
  if (!authResult.body.ok || !("profile" in authResult.body)) {
    sendJson(response, authResult.status, authResult.body);
    return true;
  }
  const profile = authResult.body.profile as { id?: string; role?: string; access_status?: string };
  const user = authResult.body.user as { id?: string } | undefined;
  const accessToken = bearerTokenFrom(request);
  if (!user?.id || !accessToken || profile.access_status !== "approved") {
    sendJson(response, 403, { ok: false, error: { code: "approval_forbidden", message: "An approved Grant OS user session is required." } });
    return true;
  }

  const canApprove = profile.role === "Admin" || profile.role === "Grant Lead";
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const pathParts = url.pathname.split("/").filter(Boolean);
  const approvalId = pathParts[3];
  const action = pathParts[4];

  if (request.method === "GET" && !approvalId) {
    const requestedStatus = url.searchParams.get("status");
    let query = userClient
      .from("agent_mutation_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (requestedStatus) query = query.eq("status", requestedStatus);
    const { data, error } = await query;
    if (error) {
      sendJson(response, 500, { ok: false, error: { code: "fetch_error", message: error.message } });
      return true;
    }
    sendJson(response, 200, {
      ok: true,
      approvals: (data ?? []).map((record) => approvalApiView(record as MutationApprovalRecord)),
      canApprove,
    });
    return true;
  }

  if (request.method === "GET" && approvalId && !action) {
    const [{ data, error }, events] = await Promise.all([
      userClient.from("agent_mutation_approvals").select("*").eq("id", approvalId).maybeSingle(),
      userClient.from("agent_mutation_approval_events").select("*").eq("approval_id", approvalId).order("created_at", { ascending: true }),
    ]);
    if (error || !data) {
      sendJson(response, 404, { ok: false, error: { code: "record_not_found", message: "Approval was not found or is not accessible." } });
      return true;
    }
    sendJson(response, 200, {
      ok: true,
      approval: approvalApiView(data as MutationApprovalRecord),
      events: events.data ?? [],
      canApprove,
    });
    return true;
  }

  if (request.method !== "POST" || !approvalId || !action) {
    sendJson(response, 405, { ok: false, error: { code: "method_not_allowed", message: "Method not allowed." } });
    return true;
  }
  if (!canApprove) {
    sendJson(response, 403, { ok: false, error: { code: "approval_forbidden", message: "Only an approved Admin or Grant Lead can approve MCP mutations." } });
    return true;
  }

  if (action === "reject") {
    const body = await readJsonBody(request);
    const reason = isRecord(body) && typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : null;
    const { data, error } = await userClient.rpc("reject_agent_mutation_approval", {
      p_approval_id: approvalId,
      p_reason: reason,
    });
    if (error || !data) {
      sendJson(response, 409, { ok: false, error: { code: approvalErrorCode(error?.message), message: error?.message ?? "Approval could not be rejected." } });
      return true;
    }
    sendJson(response, 200, { ok: true, approval: approvalApiView(data as MutationApprovalRecord) });
    return true;
  }

  if (action === "expire") {
    const { data, error } = await userClient.rpc("expire_agent_mutation_approval", {
      p_approval_id: approvalId,
    });
    if (error || !data) {
      sendJson(response, 409, { ok: false, error: { code: approvalErrorCode(error?.message), message: error?.message ?? "Approval could not be expired." } });
      return true;
    }
    sendJson(response, 200, { ok: true, approval: approvalApiView(data as MutationApprovalRecord) });
    return true;
  }

  if (action !== "approve") {
    sendJson(response, 404, { ok: false, error: { code: "unsupported_operation", message: "Unknown approval action." } });
    return true;
  }

  const { data: rawApproval, error: approvalFetchError } = await userClient
    .from("agent_mutation_approvals")
    .select("*")
    .eq("id", approvalId)
    .maybeSingle();
  if (approvalFetchError || !rawApproval) {
    sendJson(response, 404, { ok: false, error: { code: "record_not_found", message: "Approval was not found or is not accessible." } });
    return true;
  }
  const approval = rawApproval as MutationApprovalRecord;
  if (!APPROVABLE_TOOL_NAMES.has(approval.requested_tool)) {
    sendJson(response, 403, { ok: false, error: { code: "unsupported_operation", message: "The requested tool is not allowlisted for approval." } });
    return true;
  }
  if (approval.status !== "pending") {
    sendJson(response, 409, { ok: false, error: { code: "approval_not_pending", message: `Approval is ${approval.status} and cannot be executed.` } });
    return true;
  }
  if (new Date(approval.expires_at) <= new Date()) {
    sendJson(response, 409, { ok: false, error: { code: "approval_expired", message: "Approval expired and must be requested again." } });
    return true;
  }

  const authContext: AgentAuthContext = {
    actorType: "dashboard_user",
    source: "dashboard-approval",
    userId: user.id,
    userAccessToken: accessToken,
  };
  const registry = createToolRegistry({
    repository: createLiveGrantOsRepository({ authContext }),
    actor: { type: "human", id: user.id, source: "human" },
  });
  const metadata = registry.listTools().find((tool) => tool.name === approval.requested_tool);
  if (!metadata || metadata.permissionLevel !== "write_safe" || !metadata.dryRunSupported) {
    sendJson(response, 403, { ok: false, error: { code: "unsupported_operation", message: "The requested tool is no longer approval-capable." } });
    return true;
  }

  const previewInput = { ...approval.request_arguments, dryRun: true };
  const preview = await registry.execute(approval.requested_tool, previewInput);
  if (!preview.ok) {
    sendJson(response, 409, {
      ok: false,
      error: { code: preview.error.code, message: `Execution revalidation failed: ${preview.error.message}` },
      mutationPerformed: false,
      writeDisposition: "rejected",
    });
    return true;
  }
  const payloadVerification = verifyMutationApprovalPayload(approval, preview.data);
  if (!payloadVerification.ok) {
    const mismatch = buildPayloadHashMismatchResponse(approval.id);
    sendJson(response, mismatch.status, mismatch.body);
    return true;
  }

  const { data: claimed, error: claimError } = await userClient.rpc("claim_agent_mutation_approval", {
    p_approval_id: approval.id,
    p_expected_payload_hash: payloadVerification.expectedHashForClaim,
    p_execution_nonce: approval.execution_nonce,
  });
  if (claimError || !claimed) {
    const code = approvalErrorCode(claimError?.message);
    sendJson(response, 409, {
      ok: false,
      error: {
        code,
        message: approvalErrorMessage(code, claimError?.message ?? "Approval could not be claimed."),
      },
      approvalId: approval.id,
      mutationPerformed: false,
      writeDisposition: "rejected",
      ...(code === "payload_hash_mismatch" ? { requiredAction: "request_new_approval" } : {}),
    });
    return true;
  }

  let execution;
  try {
    execution = await registry.execute(approval.requested_tool, {
      ...approval.request_arguments,
      dryRun: false,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Approved mutation failed.";
    await userClient.rpc("complete_agent_mutation_approval", {
      p_approval_id: approval.id,
      p_succeeded: false,
      p_result_payload: {},
      p_affected_record_ids: [],
      p_error_code: "execution_failed",
      p_error_message: message,
    });
    sendJson(response, 500, { ok: false, error: { code: "execution_failed", message }, mutationPerformed: false, writeDisposition: "failed" });
    return true;
  }

  if (!execution.ok) {
    await userClient.rpc("complete_agent_mutation_approval", {
      p_approval_id: approval.id,
      p_succeeded: false,
      p_result_payload: {},
      p_affected_record_ids: [],
      p_error_code: execution.error.code,
      p_error_message: execution.error.message,
    });
    sendJson(response, 409, {
      ok: false,
      error: execution.error,
      mutationPerformed: false,
      writeDisposition: "failed",
      audit: execution.audit,
    });
    return true;
  }

  const resultData = execution.data && typeof execution.data === "object"
    ? execution.data as Record<string, unknown>
    : {};
  const affectedRecordIds = Array.isArray(resultData.affectedRecordIds)
    ? resultData.affectedRecordIds.filter((id): id is string => typeof id === "string")
    : [];
  const { data: completed, error: completeError } = await userClient.rpc("complete_agent_mutation_approval", {
    p_approval_id: approval.id,
    p_succeeded: true,
    p_result_payload: resultData,
    p_affected_record_ids: affectedRecordIds,
    p_error_code: null,
    p_error_message: null,
  });
  if (completeError || !completed) {
    sendJson(response, 500, {
      ok: false,
      error: { code: "approval_audit_failed", message: "The mutation executed, but its approval completion audit failed. Stop and reconcile manually." },
      mutationPerformed: true,
      writeDisposition: "committed_unconfirmed",
      affectedRecordIds,
    });
    return true;
  }

  sendJson(response, 200, {
    ok: true,
    tool: approval.requested_tool,
    approvalId: approval.id,
    dryRun: false,
    mutationPerformed: true,
    writeDisposition: "committed",
    affectedRecordIds,
    appliedMutation: resultData.appliedMutation ?? null,
    before: resultData.before ?? null,
    after: resultData.after ?? null,
    data: resultData,
    approval: approvalApiView(completed as MutationApprovalRecord),
    audit: execution.audit,
  });
  return true;
}

// ── V2.11H: Agent token management routes ────────────────────────────────
// All three endpoints require a normal Supabase user JWT.
// A gos_mcp_* agent token CANNOT call these endpoints.
async function handleAgentTokens(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (!url.pathname.startsWith("/api/agent/tokens")) return false;

  // Reject agent tokens immediately — they cannot manage other tokens
  if (requestHasAgentToken(request)) {
    sendJson(response, 401, {
      ok: false,
      error: {
        code: "agent_token_not_allowed",
        message: "Agent tokens cannot access token management endpoints. Use a normal user session.",
      },
      do_not_retry: true,
    });
    return true;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    sendJson(response, 500, { ok: false, error: { code: "supabase_not_configured", message: "Supabase is not configured." } });
    return true;
  }

  // Auth: requires a valid Supabase user JWT
  const authResult = await getAuthenticatedProfile(request, Boolean(supabaseServiceRoleKey));
  if (!authResult.body.ok || !("profile" in authResult.body)) {
    sendJson(response, authResult.status, authResult.body);
    return true;
  }
  const user = (authResult.body as Record<string, unknown>).user as { id: string } | undefined;
  if (!user?.id) {
    sendJson(response, 401, { ok: false, error: { code: "missing_user", message: "User identity could not be resolved." } });
    return true;
  }
  const userId = user.id;

  // Use service-role client for token table reads/writes (bypasses RLS for management)
  const hasServiceRole = Boolean(supabaseServiceRoleKey);
  const dbClient = hasServiceRole
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${bearerTokenFrom(request)}` } },
      });

  const pathParts = url.pathname.split("/").filter(Boolean); // ["api", "agent", "tokens", ":id"]
  const tokenId = pathParts[3]; // present for DELETE /api/agent/tokens/:id

  // GET /api/agent/tokens — list user's own tokens (metadata only)
  if (request.method === "GET" && !tokenId) {
    const { data, error } = await dbClient
      .from("agent_mcp_tokens")
      .select("id,label,token_prefix,scopes,expires_at,revoked_at,created_at,last_used_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      sendJson(response, 500, { ok: false, error: { code: "fetch_error", message: error.message } });
      return true;
    }
    sendJson(response, 200, { ok: true, tokens: data });
    return true;
  }

  // POST /api/agent/tokens — create a new token
  if (request.method === "POST" && !tokenId) {
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      sendJson(response, 400, { ok: false, error: { code: "invalid_body", message: "Request body must be a JSON object." } });
      return true;
    }

    const label = typeof body.label === "string" ? body.label.trim() : "";
    const expiryDays = typeof body.expiryDays === "number" && body.expiryDays > 0 ? body.expiryDays : null;
    const rawScopes = Array.isArray(body.scopes) ? (body.scopes as unknown[]).filter((s): s is string => typeof s === "string") : ["mcp:read"];
    if (!label || label.length > 80) {
      sendJson(response, 400, { ok: false, error: { code: "invalid_label", message: "Token label must be between 1 and 80 characters." } });
      return true;
    }
    if (expiryDays !== null && (!Number.isInteger(expiryDays) || expiryDays > 365)) {
      sendJson(response, 400, { ok: false, error: { code: "invalid_expiration", message: "Token expiration must be a whole number from 1 to 365 days." } });
      return true;
    }
    if (rawScopes.includes("mcp:write_safe_real")) {
      sendJson(response, 403, { ok: false, error: { code: "approval_required", message: "Real-write agent tokens are disabled until RLS-safe delegated authorization is configured." } });
      return true;
    }
    const scopes = normaliseScopes(rawScopes);

    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 86400 * 1000).toISOString() : null;

    const { plaintext, hash, prefix } = generateAgentToken();

    const { data: inserted, error: insertError } = await dbClient
      .from("agent_mcp_tokens")
      .insert([{
        user_id: userId,
        label,
        token_hash: hash,
        token_prefix: prefix,
        scopes,
        expires_at: expiresAt,
      }])
      .select("id,label,token_prefix,scopes,expires_at,created_at")
      .single();

    if (insertError || !inserted) {
      sendJson(response, 500, { ok: false, error: { code: "create_failed", message: insertError?.message ?? "Token creation failed." } });
      return true;
    }

    // Plaintext returned ONCE ONLY — never stored, never in subsequent list responses
    sendJson(response, 200, {
      ok: true,
      token: plaintext,                  // show once
      id: inserted.id,
      label: inserted.label,
      token_prefix: inserted.token_prefix,
      scopes: inserted.scopes,
      expires_at: inserted.expires_at,
      created_at: inserted.created_at,
      warning: "Store this token securely. It will not be shown again.",
    });
    return true;
  }

  // DELETE /api/agent/tokens/:id — revoke a token
  if (request.method === "DELETE" && tokenId) {
    // Verify the token belongs to the requesting user before revoking
    const { data: existing, error: fetchError } = await dbClient
      .from("agent_mcp_tokens")
      .select("id,user_id,revoked_at")
      .eq("id", tokenId)
      .maybeSingle();

    if (fetchError || !existing) {
      sendJson(response, 404, { ok: false, error: { code: "token_not_found", message: "Token not found." } });
      return true;
    }
    if (existing.user_id !== userId) {
      sendJson(response, 403, { ok: false, error: { code: "forbidden", message: "You do not own this token." } });
      return true;
    }
    if (existing.revoked_at) {
      sendJson(response, 200, { ok: true, message: "Token was already revoked.", revoked_at: existing.revoked_at });
      return true;
    }

    const revokedAt = new Date().toISOString();
    const { error: updateError } = await dbClient
      .from("agent_mcp_tokens")
      .update({ revoked_at: revokedAt })
      .eq("id", tokenId);

    if (updateError) {
      sendJson(response, 500, { ok: false, error: { code: "revoke_failed", message: updateError.message } });
      return true;
    }

    sendJson(response, 200, { ok: true, message: "Token revoked.", revoked_at: revokedAt });
    return true;
  }

  sendJson(response, 405, { ok: false, error: { code: "method_not_allowed", message: "Method not allowed." } });
  return true;
}

async function handleApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  // V2.11H: Reject agent tokens (gos_mcp_*) on all non-MCP routes early,
  // before they reach getAuthenticatedProfile() which would give confusing errors.
  const isMcpRoute =
    url.pathname === "/api/mcp/tools" ||
    url.pathname === "/api/mcp/call" ||
    url.pathname === "/api/mcp/doctor" ||
    url.pathname === "/api/agent/guide";

  if (requestHasAgentToken(request) && !isMcpRoute) {
    if (!url.pathname.startsWith("/api/agent/") && !url.pathname.startsWith("/api/mcp/")) {
      return false; // not an API route, don't handle
    }
    sendJson(response, 401, {
      ok: false,
      error: {
        code: "agent_token_not_allowed",
        message: "Agent tokens (gos_mcp_*) are only valid for GET /api/mcp/tools and POST /api/mcp/call. Use a normal user session for this route.",
      },
      do_not_retry: true,
    });
    return true;
  }

  if (url.pathname.startsWith("/api/admin/users")) return handleAdminUsers(request, response);
  if (url.pathname.startsWith("/api/team/")) return handleTeamInvite(request, response);
  if (url.pathname.startsWith("/api/agent-knowledge/")) return handleAgentKnowledge(request, response);
  if (url.pathname.startsWith("/api/agent/approvals")) return handleAgentApprovals(request, response);
  if (url.pathname.startsWith("/api/agent/tokens")) return handleAgentTokens(request, response);
  if (!url.pathname.startsWith("/api/agent/") && !url.pathname.startsWith("/api/mcp/")) return false;

  // Public guide — no auth required
  if (url.pathname === "/api/agent/guide" && request.method === "GET") {
    const result = mcpAdapter.handleGuide();
    sendJson(response, result.status, result.body);
    return true;
  }

  try {
    if (url.pathname === "/api/agent/doctor" && request.method === "GET") {
      const result = await agentApi.handleDoctor(request.headers);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/agent/tool" && request.method === "POST") {
      const body = await readJsonBody(request);
      const result = await agentApi.handleTool(request.headers, body);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/mcp/tools" && request.method === "GET") {
      const result = await mcpAdapter.handleTools(request.headers);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/mcp/call" && request.method === "POST") {
      const body = await readJsonBody(request);
      const result = await mcpAdapter.handleCall(request.headers, body);
      sendJson(response, result.status, result.body);
      return true;
    }

    if (url.pathname === "/api/mcp/doctor" && request.method === "GET") {
      const result = await mcpAdapter.handleDoctor(request.headers);
      sendJson(response, result.status, result.body);
      return true;
    }

    sendJson(response, 404, {
      ok: false,
      error: { code: "not_found", message: "Agent API route not found." },
    });
    return true;
  } catch {
    sendJson(response, 500, {
      ok: false,
      error: { code: "internal_error", message: "Agent API request failed." },
    });
    return true;
  }
}

async function start() {
  const vite = isProduction
    ? null
    : await import("vite").then(({ createServer: createViteServer }) =>
        createViteServer({
          root,
          server: { middlewareMode: true, host: "0.0.0.0", allowedHosts: true },
          appType: "spa",
          configFile: path.resolve(root, "vite.config.ts"),
        })
      );

  const server = createServer(async (request, response) => {
    if (await handleApi(request, response)) return;

    if (vite) {
      vite.middlewares(request, response, () => {
        sendJson(response, 404, {
          ok: false,
          error: { code: "not_found", message: "Route not found." },
        });
      });
      return;
    }

    if (!existsSync(path.resolve(distPublic, "index.html"))) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("Grant OS build output is missing. Run pnpm build first.");
      return;
    }

    await serveStatic(request, response);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[Grant OS] serving ${isProduction ? "production" : "development"} app on port ${port}`);
  });
}

await start();
