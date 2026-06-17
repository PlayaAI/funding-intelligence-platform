import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createAgentApi } from "../lib/agent-api/agentApi";
import { createMcpAdapter } from "../lib/agent-mcp/adapter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const distPublic = path.resolve(root, "dist/public");
const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
const isProduction = process.env.NODE_ENV === "production";
const agentApi = createAgentApi();
const mcpAdapter = createMcpAdapter();
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
    .select("id,email,full_name,role")
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
  if (profile.role !== "Admin") {
    sendJson(response, 403, {
      ok: false,
      error: { code: "admin_required", message: "Only admins can perform this action." },
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

    const profile = authResult.body.profile as { role?: string };
    if (profile.role !== "Admin") {
      sendJson(response, 403, {
        ok: false,
        error: { code: "admin_required", message: "Only admins can invite teammates." },
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

      // Handle the target item creation or update
      let targetItemId = proposal.target_item_id;
      if (proposal.proposal_type === "add" || !targetItemId) {
        const { data: newItem, error: insertError } = await client.from("agent_knowledge_items").insert([{
          title: proposal.title,
          category: proposal.category,
          content: proposal.proposed_content,
          knowledge_type: proposal.proposal_type === "add" ? "custom_instruction" : proposal.proposal_type,
          priority: "medium",
          status: "active",
          created_by: authResult.body.user?.id,
          source_label: proposal.source_type,
        }]).select("id").single();
        if (insertError) return sendJson(response, 500, { ok: false, error: insertError }), true;
        targetItemId = newItem.id;
      } else if (proposal.proposal_type === "edit") {
        const { error: updateError } = await client.from("agent_knowledge_items").update({
          content: proposal.proposed_content,
          updated_by: authResult.body.user?.id
        }).eq("id", targetItemId);
        if (updateError) return sendJson(response, 500, { ok: false, error: updateError }), true;
      } else if (proposal.proposal_type === "archive") {
        const { error: updateError } = await client.from("agent_knowledge_items").update({
          status: "archived",
          updated_by: authResult.body.user?.id
        }).eq("id", targetItemId);
        if (updateError) return sendJson(response, 500, { ok: false, error: updateError }), true;
      }

      // Update proposal status
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

async function handleApi(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname.startsWith("/api/admin/users")) return handleAdminUsers(request, response);
  if (url.pathname.startsWith("/api/team/")) return handleTeamInvite(request, response);
  if (url.pathname.startsWith("/api/agent-knowledge/")) return handleAgentKnowledge(request, response);
  if (!url.pathname.startsWith("/api/agent/") && !url.pathname.startsWith("/api/mcp/")) return false;

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
