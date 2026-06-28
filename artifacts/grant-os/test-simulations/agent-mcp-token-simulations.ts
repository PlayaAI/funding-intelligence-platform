/**
 * agent-mcp-token-simulations.ts — V2.11H
 *
 * Tests for Grant OS MCP Agent Access Tokens.
 * Mode: in-memory repository and in-memory token store. No real DB, no real Supabase.
 */

import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";
import {
  generateAgentToken,
  hashAgentToken,
  type AgentTokenRecord,
} from "../src/lib/agent-mcp/agentTokenService";
import type { AgentApiClient } from "../src/lib/agent-mcp/client";

type TestResult = { name: string; passed: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ── JWT helpers (same pattern as existing MCP simulations) ─────────────────

function base64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fakeJwt(payload: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: "none", typ: "JWT" })),
    base64Url(JSON.stringify(payload)),
    "signature",
  ].join(".");
}

const normalUserJwt = fakeJwt({ role: "authenticated", sub: "user-123" });
const serviceRoleJwt = fakeJwt({ role: "service_role", sub: "service" });

function jwtHeaders(token = normalUserJwt) {
  return { authorization: `Bearer ${token}` };
}

// ── In-memory token store ──────────────────────────────────────────────────

type StoredToken = AgentTokenRecord & { token_hash: string };

function makeTokenStore() {
  const store = new Map<string, StoredToken>();

  function addToken(overrides: Partial<StoredToken> & { scopes: string[] }): { plaintext: string; record: StoredToken } {
    const { plaintext, hash, prefix } = generateAgentToken();
    const record: StoredToken = {
      id: `token-${store.size + 1}`,
      user_id: "user-123",
      label: "test token",
      token_hash: hash,
      token_prefix: prefix,
      scopes: overrides.scopes,
      expires_at: overrides.expires_at ?? null,
      revoked_at: overrides.revoked_at ?? null,
    };
    Object.assign(record, overrides);
    store.set(hash, record);
    return { plaintext, record };
  }

  async function resolveAgentToken(hash: string): Promise<AgentTokenRecord | null> {
    return store.get(hash) ?? null;
  }

  async function updateAgentTokenLastUsed(_id: string): Promise<void> {
    // no-op for tests
  }

  return { addToken, resolveAgentToken, updateAgentTokenLastUsed, store };
}

// ── Adapter factory for tests ──────────────────────────────────────────────

function makeAdapter(tokenStore: ReturnType<typeof makeTokenStore>) {
  const repository = createInMemoryGrantOsRepository();
  const upstream: AgentApiClient = {
    async doctor() {
      return { status: 200, body: { ok: true } };
    },
    async tool() {
      throw new Error("tool forwarding not used in token tests");
    },
  };

  const adapter = createMcpAdapter({
    upstreamClient: upstream,
    createRepository: () => repository,
    createRegistry: createToolRegistry,
    resolveAgentToken: tokenStore.resolveAgentToken,
    updateAgentTokenLastUsed: tokenStore.updateAgentTokenLastUsed,
    serviceRoleKey: null, // no real service-role in tests
  });

  return { adapter, repository };
}

// ── Helper for agent match arguments ──────────────────────────────────────

function validAgentMatchArgs(overrides: Record<string, unknown> = {}) {
  return {
    grantId: "grant-1",
    projectId: "project-1",
    fitScore: 9,
    urgencyScore: 7,
    effortScore: 4,
    strategicValueScore: 9,
    recommendation: "apply_now",
    summary: "Strong match.",
    whyItFits: "Aligned with AI work.",
    whyItMightNotFit: "Eligibility review needed.",
    bestProjectAngle: "Applied community AI.",
    strongestApplicationStory: "Field-tested evidence.",
    risks: [],
    missingInfo: [],
    evidenceNeeded: [],
    recommendedNextStep: "Approve save.",
    ...overrides,
  };
}

async function run() {
  const tokenStore = makeTokenStore();

  // Pre-create tokens for tests
  const { plaintext: readOnlyToken } = tokenStore.addToken({ scopes: ["mcp:read"] });
  const { plaintext: writeSafeDryRunToken } = tokenStore.addToken({ scopes: ["mcp:read", "mcp:write_safe_dry_run"] });

  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const { plaintext: expiredToken } = tokenStore.addToken({
    scopes: ["mcp:read"],
    expires_at: pastDate,
  });

  const { plaintext: revokedToken } = tokenStore.addToken({
    scopes: ["mcp:read"],
    revoked_at: new Date().toISOString(),
  });

  const { adapter, repository } = makeAdapter(tokenStore);

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [

    // ── 1. Valid agent token (mcp:read) → handleTools 200 ─────────────────
    {
      name: "V2.11H: valid read-only agent token → handleTools returns 200",
      fn: async () => {
        const result = await adapter.handleTools({ authorization: `Bearer ${readOnlyToken}` });
        assert(result.status === 200, `expected 200, got ${result.status}`);
        assert(result.body.ok === true, "expected ok true");
        const tools = (result.body.tools ?? []) as Array<{ name?: string }>;
        assert(tools.length > 0, "expected non-empty tool list");
        assert(tools.some((t) => t.name === "list_grant_matches"), "expected list_grant_matches in tools");
      },
    },

    // ── 2. Valid agent token (mcp:read) → handleCall list_grant_matches ────
    {
      name: "V2.11H: valid read-only agent token → handleCall list_grant_matches returns 200",
      fn: async () => {
        const result = await adapter.handleCall(
          { authorization: `Bearer ${readOnlyToken}` },
          { name: "list_grant_matches", arguments: { limit: 3, includeDetails: false } }
        );
        assert(result.status === 200, `expected 200, got ${result.status}: ${JSON.stringify(result.body)}`);
        assert(result.body.ok === true, "expected ok true");
      },
    },

    // ── 3. Valid agent token → handleCall get_grant_decision_brief ─────────
    {
      name: "V2.11H: valid read-only agent token → handleCall get_grant_decision_brief returns 200",
      fn: async () => {
        const result = await adapter.handleCall(
          { authorization: `Bearer ${readOnlyToken}` },
          { name: "get_grant_decision_brief", arguments: { grantId: "grant-1" } }
        );
        assert(result.status === 200, `expected 200, got ${result.status}: ${JSON.stringify(result.body)}`);
        assert(result.body.ok === true, "expected ok true");
      },
    },

    // ── 4. Read-only token cannot call write_safe tool ─────────────────────
    {
      name: "V2.11H: read-only token → write_safe tool → 403 scope_insufficient",
      fn: async () => {
        const result = await adapter.handleCall(
          { authorization: `Bearer ${readOnlyToken}` },
          { name: "create_task", arguments: { title: "Test task", dryRun: true } }
        );
        assert(result.status === 403, `expected 403, got ${result.status}`);
        const body = result.body as Record<string, unknown>;
        const errorCode = (body.error as Record<string, unknown>)?.code;
        assert(errorCode === "scope_insufficient", `expected scope_insufficient, got ${errorCode}`);
      },
    },

    // ── 5. write_safe_dry_run token forces dryRun true even if caller sends false ─
    {
      name: "V2.11H: write_safe_dry_run token + dryRun:false → dryRun forced true",
      fn: async () => {
        const before = repository.snapshot().tasks.length;
        const result = await adapter.handleCall(
          { authorization: `Bearer ${writeSafeDryRunToken}` },
          { name: "create_task", arguments: { title: "Test task", dryRun: false } }
        );
        assert(result.status === 200, `expected 200, got ${result.status}: ${JSON.stringify(result.body)}`);
        const body = result.body as { dryRun?: boolean; writeDisposition?: string };
        assert(body.dryRun === true, `expected dryRun=true, got ${body.dryRun}`);
        assert(body.writeDisposition === "dry_run", `expected dry_run disposition, got ${body.writeDisposition}`);
        const after = repository.snapshot().tasks.length;
        assert(before === after, "dryRun forced: no task should be created in repository");
      },
    },

    // ── 6. Any agent token cannot call blocked/approval-required tool ───────
    {
      name: "V2.11H: agent token → blocked tool archive_record → 403",
      fn: async () => {
        const result = await adapter.handleCall(
          { authorization: `Bearer ${writeSafeDryRunToken}` },
          { name: "archive_record", arguments: { recordType: "grant", recordId: "grant-1", reason: "test" } }
        );
        assert(result.status === 403, `expected 403, got ${result.status}`);
        assert(
          JSON.stringify(result.body).includes("approval_required_or_not_enabled"),
          "expected approval_required_or_not_enabled error"
        );
      },
    },

    // ── 7. Agent token on /api/mcp/doctor is rejected ──────────────────────
    {
      name: "V2.11H: agent token on handleDoctor → 401 agent_token_not_allowed",
      fn: async () => {
        const result = await adapter.handleDoctor({ authorization: `Bearer ${readOnlyToken}` });
        assert(result.status === 401, `expected 401, got ${result.status}`);
        const body = result.body as Record<string, unknown>;
        const errorCode = (body.error as Record<string, unknown>)?.code;
        assert(errorCode === "agent_token_not_allowed", `expected agent_token_not_allowed, got ${errorCode}`);
      },
    },

    // ── 8. Expired token → 401 agent_token_expired ─────────────────────────
    {
      name: "V2.11H: expired agent token → 401 agent_token_expired",
      fn: async () => {
        const result = await adapter.handleCall(
          { authorization: `Bearer ${expiredToken}` },
          { name: "list_grant_matches", arguments: {} }
        );
        assert(result.status === 401, `expected 401, got ${result.status}`);
        const body = result.body as Record<string, unknown>;
        const errorCode = (body.error as Record<string, unknown>)?.code;
        assert(errorCode === "agent_token_expired", `expected agent_token_expired, got ${errorCode}`);
      },
    },

    // ── 9. Revoked token → 401 agent_token_revoked ─────────────────────────
    {
      name: "V2.11H: revoked agent token → 401 agent_token_revoked",
      fn: async () => {
        const result = await adapter.handleTools({ authorization: `Bearer ${revokedToken}` });
        assert(result.status === 401, `expected 401, got ${result.status}`);
        const body = result.body as Record<string, unknown>;
        const errorCode = (body.error as Record<string, unknown>)?.code;
        assert(errorCode === "agent_token_revoked", `expected agent_token_revoked, got ${errorCode}`);
      },
    },

    // ── 10. Unknown/invalid token → 401 agent_token_invalid ────────────────
    {
      name: "V2.11H: unknown agent token (gos_mcp_ prefix, not in store) → 401 agent_token_invalid",
      fn: async () => {
        const fakeToken = "gos_mcp_" + "0".repeat(32); // valid format but not in store
        const result = await adapter.handleTools({ authorization: `Bearer ${fakeToken}` });
        assert(result.status === 401, `expected 401, got ${result.status}`);
        const body = result.body as Record<string, unknown>;
        const errorCode = (body.error as Record<string, unknown>)?.code;
        assert(errorCode === "agent_token_invalid", `expected agent_token_invalid, got ${errorCode}`);
      },
    },

    // ── 11. Normal Supabase JWT still works for handleTools (regression) ────
    {
      name: "V2.11H regression: normal JWT still works for handleTools",
      fn: async () => {
        const result = await adapter.handleTools(jwtHeaders(normalUserJwt));
        assert(result.status === 200, `expected 200, got ${result.status}`);
        assert(result.body.ok === true, "expected ok true");
      },
    },

    // ── 12. Normal Supabase JWT still works for handleCall (regression) ─────
    {
      name: "V2.11H regression: normal JWT still works for handleCall",
      fn: async () => {
        const result = await adapter.handleCall(
          jwtHeaders(normalUserJwt),
          { name: "search_grants", arguments: { query: "test" } }
        );
        assert(result.status === 200, `expected 200, got ${result.status}`);
        assert(result.body.ok === true, "expected ok true");
      },
    },

    // ── 13. service_role JWT still rejected (regression) ───────────────────
    {
      name: "V2.11H regression: service_role JWT still rejected",
      fn: async () => {
        const result = await adapter.handleTools(jwtHeaders(serviceRoleJwt));
        assert(result.status === 401, `expected 401, got ${result.status}`);
        assert(JSON.stringify(result.body).includes("service_role_rejected"), "expected service_role_rejected");
      },
    },

    // ── 14. Guide documents agent token auth (V2.11H) ──────────────────────
    {
      name: "V2.11H: guide documents preferred_auth_for_external_agents",
      fn: async () => {
        const result = adapter.handleGuide();
        assert(result.status === 200, "expected 200");
        const body = result.body as Record<string, unknown>;
        assert(body.version === "V2.11J", `expected V2.11J, got ${body.version}`);
        assert(typeof body.preferred_auth_for_external_agents === "string", "expected preferred_auth_for_external_agents");
        assert((body.preferred_auth_for_external_agents as string).includes("agent_access_token"), "expected agent_access_token in auth note");
        assert(typeof body.how_to_get_agent_token === "string", "expected how_to_get_agent_token");
        assert(typeof body.do_not_store === "string", "expected do_not_store");
        assert(typeof body.if_token_fails === "string", "expected if_token_fails");
        const tokenCodes = body.token_error_codes as Record<string, string>;
        assert(typeof tokenCodes?.agent_token_invalid === "string", "expected agent_token_invalid in token_error_codes");
        assert(typeof tokenCodes?.agent_token_expired === "string", "expected agent_token_expired in token_error_codes");
        assert(typeof tokenCodes?.agent_token_revoked === "string", "expected agent_token_revoked in token_error_codes");
        assert(typeof tokenCodes?.scope_insufficient === "string", "expected scope_insufficient in token_error_codes");
      },
    },

    // ── 15. Token plaintext not present in read-only token bearer (sanity) ──
    {
      name: "V2.11H: agent token handleTools response does not leak token value",
      fn: async () => {
        const result = await adapter.handleTools({ authorization: `Bearer ${readOnlyToken}` });
        assert(result.status === 200, "expected 200");
        assert(!JSON.stringify(result.body).includes(readOnlyToken), "response must not contain raw token value");
      },
    },

    // ── 16. Token hash never in handleTools/handleCall responses ───────────
    {
      name: "V2.11H: token hash not in any MCP response",
      fn: async () => {
        const hash = hashAgentToken(readOnlyToken);
        const toolsResult = await adapter.handleTools({ authorization: `Bearer ${readOnlyToken}` });
        const callResult = await adapter.handleCall(
          { authorization: `Bearer ${readOnlyToken}` },
          { name: "list_grant_matches", arguments: {} }
        );
        assert(!JSON.stringify(toolsResult.body).includes(hash), "handleTools response must not contain token hash");
        assert(!JSON.stringify(callResult.body).includes(hash), "handleCall response must not contain token hash");
      },
    },

    // ── 17. mcp:write_safe_execute scope downgraded to dry_run ─────────────
    {
      name: "V2.11H: token with mcp:write_safe_execute scope downgraded → dryRun forced",
      fn: async () => {
        const { plaintext: futureScopeToken } = tokenStore.addToken({ scopes: ["mcp:write_safe_execute"] });
        const result = await adapter.handleCall(
          { authorization: `Bearer ${futureScopeToken}` },
          { name: "create_task", arguments: { title: "Future scope test", dryRun: false } }
        );
        // mcp:write_safe_execute normalised to mcp:write_safe_dry_run
        assert(result.status === 200, `expected 200, got ${result.status}: ${JSON.stringify(result.body)}`);
        const body = result.body as { dryRun?: boolean; writeDisposition?: string };
        assert(body.dryRun === true, "expected dryRun=true (execute scope downgraded)");
        assert(body.writeDisposition === "dry_run", "expected dry_run disposition");
      },
    },

    // ── 18. save_agent_match defaults to dry-run through agent token ────────
    {
      name: "V2.11H: save_agent_match via write_safe_dry_run token → dryRun forced true",
      fn: async () => {
        const before = repository.snapshot().grantMatches.length;
        const result = await adapter.handleCall(
          { authorization: `Bearer ${writeSafeDryRunToken}` },
          { name: "save_agent_match", arguments: validAgentMatchArgs({ dryRun: false }) }
        );
        assert(result.status === 200, `expected 200, got ${result.status}: ${JSON.stringify(result.body)}`);
        const body = result.body as { dryRun?: boolean };
        assert(body.dryRun === true, "expected dryRun=true forced by agent token");
        assert(repository.snapshot().grantMatches.length === before, "no mutation should have occurred");
      },
    },

    // ── 19. Missing auth still gives agent_required shape (regression) ──────
    {
      name: "V2.11H regression: missing auth on handleTools returns auth_required",
      fn: async () => {
        const result = await adapter.handleTools({});
        assert(result.status === 401, "expected 401");
        const body = result.body as Record<string, unknown>;
        assert(body.error === "auth_required", `expected auth_required, got ${JSON.stringify(body.error)}`);
        assert(body.do_not_treat_as_missing_tools === true, "expected do_not_treat_as_missing_tools true");
      },
    },

    // ── 20. write_safe_dry_run token can list read tools (not just write) ───
    {
      name: "V2.11H: write_safe_dry_run token can call read tool (list_grant_matches)",
      fn: async () => {
        const result = await adapter.handleCall(
          { authorization: `Bearer ${writeSafeDryRunToken}` },
          { name: "list_grant_matches", arguments: { limit: 2 } }
        );
        assert(result.status === 200, `expected 200, got ${result.status}: ${JSON.stringify(result.body)}`);
        assert(result.body.ok === true, "expected ok true");
      },
    },

  ];

  const results: TestResult[] = [];
  for (const testCase of cases) {
    try {
      await testCase.fn();
      results.push({ name: testCase.name, passed: true });
    } catch (error) {
      results.push({ name: testCase.name, passed: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log("Grant OS V2.11H Agent MCP Token Simulations");
  console.log("Mode: in-memory repository and token store / no real Supabase reads or writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");

  if (failed > 0) process.exit(1);
}

void run();
