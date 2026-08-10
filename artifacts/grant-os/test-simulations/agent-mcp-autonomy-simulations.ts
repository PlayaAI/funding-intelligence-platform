import { readFileSync } from "node:fs";
import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import {
  checkAutonomyPolicy,
  defaultAllowedAutonomyTools,
  type AgentAutonomyPolicyRecord,
  type AgentAutonomyStore,
} from "../src/lib/agent-mcp/autonomyPolicy";
import { generateAgentToken, type AgentTokenRecord } from "../src/lib/agent-mcp/agentTokenService";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";

type TestResult = { name: string; passed: boolean; error?: string };
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

const fullAutonomyScopes = [
  "mcp:read",
  "mcp:write_safe_dry_run",
  "mcp:autonomy:execute",
  "mcp:discovery:run",
  "mcp:grants:create",
  "mcp:grants:archive",
  "mcp:grants:update_status",
  "mcp:grants:top_three",
  "mcp:applications:create",
  "mcp:applications:update",
  "mcp:tasks:create",
  "mcp:tasks:update",
  "mcp:knowledge:propose",
];

function makeTokenStore() {
  const records = new Map<string, AgentTokenRecord>();
  function add(scopes: string[], id = `token-${records.size + 1}`) {
    const generated = generateAgentToken();
    records.set(generated.hash, {
      id,
      user_id: "user-123",
      label: "autonomous grant operator",
      token_prefix: generated.prefix,
      scopes,
      expires_at: null,
      revoked_at: null,
      created_at: "2026-08-10T00:00:00.000Z",
      last_used_at: null,
    });
    return { plaintext: generated.plaintext, id };
  }
  return { add, resolveAgentToken: async (hash: string) => records.get(hash) ?? null, updateAgentTokenLastUsed: async () => {} };
}

function makeAutonomyStore(policy: AgentAutonomyPolicyRecord | null): AgentAutonomyStore & { events: Map<string, Record<string, unknown>> } {
  const events = new Map<string, Record<string, unknown>>();
  return {
    events,
    async resolvePolicy(tokenId) { return policy?.token_id === tokenId ? policy : null; },
    async getUsage() { return { writesToday: [...events.values()].filter((event) => event.mutationPerformed === true).length }; },
    async claimExecution(input) {
      const key = `${input.tokenId}:${input.idempotencyKey}`;
      if (events.has(key)) return { ok: false, code: "replay_detected", message: "duplicate idempotency key" };
      const eventId = `event-${events.size + 1}`;
      events.set(key, { ...input, eventId, status: "claimed", mutationPerformed: false });
      return { ok: true, eventId };
    },
    async completeExecution(eventId, input) {
      const entry = [...events.entries()].find(([, value]) => value.eventId === eventId);
      if (!entry) throw new Error("event missing");
      events.set(entry[0], { ...entry[1], ...input, status: input.errorCode ? "failed" : "completed" });
    },
  };
}

const candidate = {
  title: "Verified Community AI Fund",
  funderName: "Example Foundation",
  sourceUrl: "https://example.org/funds/community-ai?utm_source=test",
  applicationUrl: "https://example.org/funds/community-ai/apply",
  sourceType: "primary" as const,
  verificationStatus: "verified" as const,
  deadline: "2027-12-31",
  deadlineVerificationStatus: "verified" as const,
  applicantPathStatus: "verified" as const,
  lastVerifiedAt: "2026-08-10T08:00:00.000Z",
  focusAreas: ["Community AI", "Arts"],
  relatedProjectId: "project-1",
  fitScore: 91,
  priorityScore: 93,
};

async function run() {
  const tokenStore = makeTokenStore();
  const { plaintext: autonomousToken, id: tokenId } = tokenStore.add(fullAutonomyScopes, "token-autonomous");
  const { plaintext: noPolicyToken } = tokenStore.add(fullAutonomyScopes, "token-no-policy");
  const policy: AgentAutonomyPolicyRecord = {
    id: "policy-1",
    token_id: tokenId,
    user_id: "user-123",
    enabled: true,
    allowed_tools: defaultAllowedAutonomyTools(fullAutonomyScopes),
    daily_write_limit: 100,
    max_batch_size: 50,
    minimum_fit_score: 80,
    minimum_deadline_days: 14,
    require_primary_source: true,
    allow_internal_applications: true,
    allow_task_management: true,
    expires_at: null,
    created_at: "2026-08-10T00:00:00.000Z",
    updated_at: "2026-08-10T00:00:00.000Z",
  };
  const repository = createInMemoryGrantOsRepository();
  const store = makeAutonomyStore(policy);
  const adapter = createMcpAdapter({
    createRepository: () => repository,
    createRegistry: createToolRegistry,
    resolveAgentToken: tokenStore.resolveAgentToken,
    updateAgentTokenLastUsed: tokenStore.updateAgentTokenLastUsed,
    autonomyStore: store,
    serviceRoleKey: null,
  });
  const headers = (token = autonomousToken) => ({ authorization: `Bearer ${token}` });

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "discovery brief and both cycle names are exposed compactly",
      fn: async () => {
        const toolsResult = await adapter.handleTools(headers());
        const names = ((toolsResult.body.tools ?? []) as Array<{ name?: string }>).map((tool) => tool.name);
        for (const name of ["get_grant_discovery_brief", "run_grant_discovery_cycle", "run_autonomous_grant_ops_cycle", "create_grant"]) assert(names.includes(name), `missing ${name}`);
        const brief = await adapter.handleCall(headers(), { name: "get_grant_discovery_brief", arguments: { projectLimit: 3 } });
        assert(brief.status === 200, JSON.stringify(brief.body));
        assert(JSON.stringify(brief.body).length < 12000, "discovery brief is too verbose");
      },
    },
    {
      name: "candidate validation is compact and identifies automatic application eligibility",
      fn: async () => {
        const result = await adapter.handleCall(headers(), { name: "validate_grant_candidate", arguments: candidate });
        assert(result.status === 200, JSON.stringify(result.body));
        const data = result.body.data as { autoApplicationEligible?: boolean };
        assert(data.autoApplicationEligible === true, "verified candidate should be application eligible");
        assert(!JSON.stringify(result.body).includes("extracted_text"), "compact validation leaked long document fields");
      },
    },
    {
      name: "create_grant defaults to dry-run and does not mutate",
      fn: async () => {
        const before = repository.snapshot().grants.length;
        const result = await adapter.handleCall(headers(), { name: "create_grant", arguments: { candidate } });
        assert(result.status === 200, JSON.stringify(result.body));
        assert(result.body.dryRun === true, "write tool did not default to dry-run");
        assert(result.body.mutationPerformed === false, "preview mutated");
        assert(repository.snapshot().grants.length === before, "preview created a grant");
      },
    },
    {
      name: "autonomy scope without token-bound policy cannot write",
      fn: async () => {
        const before = repository.snapshot().grants.length;
        const result = await adapter.handleCall(headers(noPolicyToken), { name: "create_grant", arguments: { candidate, dryRun: false, idempotencyKey: "no-policy-create-1" } });
        assert(result.status === 403, JSON.stringify(result.body));
        assert((result.body.error as { code?: string }).code === "autonomy_policy_required", "missing policy should be explicit");
        assert(repository.snapshot().grants.length === before, "missing-policy request mutated");
      },
    },
    {
      name: "policy-authorized create_grant commits a Researching source-backed grant",
      fn: async () => {
        const before = repository.snapshot().grants.length;
        const result = await adapter.handleCall(headers(), { name: "create_grant", arguments: { candidate, dryRun: false, idempotencyKey: "create-verified-grant-1" } });
        assert(result.status === 200, JSON.stringify(result.body));
        assert(result.body.mutationPerformed === true && result.body.writeDisposition === "committed", "autonomous create did not commit");
        assert(repository.snapshot().grants.length === before + 1, "grant count did not increase");
        const created = repository.snapshot().grants.find((grant) => grant.title === candidate.title);
        assert(created?.status === "Researching", "agent-created grant must start Researching");
        assert(created?.is_top_three === false, "create_grant must not directly set Top 3");
        assert(created?.source_type === "primary", "provenance not stored");
        assert(!JSON.stringify(result.body).includes(autonomousToken), "token plaintext leaked");
      },
    },
    {
      name: "create_grant duplicate is rejected without adding a row",
      fn: async () => {
        const before = repository.snapshot().grants.length;
        const result = await adapter.handleCall(headers(), { name: "create_grant", arguments: { candidate, dryRun: false, idempotencyKey: "duplicate-create-2" } });
        assert(result.status !== 200, "duplicate create unexpectedly succeeded");
        assert((result.body.error as { code?: string }).code === "duplicate_record", JSON.stringify(result.body));
        assert(repository.snapshot().grants.length === before, "duplicate create added a row");
      },
    },
    {
      name: "partial source refresh preserves verified fields and project links",
      fn: async () => {
        const result = await adapter.handleCall(headers(), {
          name: "upsert_grant_from_source",
          arguments: {
            candidate: {
              title: candidate.title,
              funderName: candidate.funderName,
              sourceUrl: candidate.sourceUrl,
            },
            dryRun: false,
            idempotencyKey: "partial-refresh-preserves-fields-1",
          },
        });
        assert(result.status === 200, JSON.stringify(result.body));
        const updated = repository.snapshot().grants.find((grant) => grant.title === candidate.title);
        assert(updated?.related_project_id === candidate.relatedProjectId, "partial refresh cleared project link");
        assert(updated?.application_url === candidate.applicationUrl, "partial refresh cleared application URL");
        assert(updated?.verification_status === "verified", "partial refresh downgraded verification");
        assert(updated?.source_type === "primary", "partial refresh downgraded source type");
      },
    },
    {
      name: "replayed autonomous request is rejected before mutation",
      fn: async () => {
        const other = { ...candidate, title: "Replay Safe Grant", sourceUrl: "https://example.org/replay-safe", applicationUrl: "https://example.org/replay-safe/apply" };
        const first = await adapter.handleCall(headers(), { name: "create_grant", arguments: { candidate: other, dryRun: false, idempotencyKey: "replay-key-123" } });
        assert(first.status === 200, JSON.stringify(first.body));
        const before = repository.snapshot().grants.length;
        const second = await adapter.handleCall(headers(), { name: "create_grant", arguments: { candidate: { ...other, title: "Changed after claim" }, dryRun: false, idempotencyKey: "replay-key-123" } });
        assert(second.status === 409, JSON.stringify(second.body));
        assert((second.body.error as { code?: string }).code === "replay_detected", "expected replay_detected");
        assert(repository.snapshot().grants.length === before, "replay mutated records");
      },
    },
    {
      name: "autonomous cycle ingests, ranks, and creates only internal application tasks",
      fn: async () => {
        const cycleCandidate = { ...candidate, title: "Autonomous Cycle Fund", sourceUrl: "https://example.org/autonomous-cycle", applicationUrl: "https://example.org/autonomous-cycle/apply" };
        const beforeApps = repository.snapshot().applications.length;
        const beforeTasks = repository.snapshot().tasks.length;
        const result = await adapter.handleCall(headers(), {
          name: "run_autonomous_grant_ops_cycle",
          arguments: { candidates: [cycleCandidate], archiveExpired: true, recalculateTopThree: true, startEligibleApplications: true, dryRun: false, idempotencyKey: "cycle-2026-08-10-1" },
        });
        assert(result.status === 200, JSON.stringify(result.body));
        const data = result.body.data as { counts?: { applicationsCreated?: number; tasksCreated?: number }; warnings?: string[] };
        assert(data.counts?.applicationsCreated === 1, "cycle did not create one internal application");
        assert(data.counts?.tasksCreated === 3, "cycle did not create checklist tasks");
        assert(repository.snapshot().applications.length === beforeApps + 1, "application count mismatch");
        assert(repository.snapshot().tasks.length === beforeTasks + 3, "task count mismatch");
        assert(JSON.stringify(data.warnings).includes("submission"), "cycle must state that submission was not performed");
      },
    },
    {
      name: "autonomous cycle requires every granular sub-scope",
      fn: async () => {
        const limitedStore = makeTokenStore();
        const { plaintext, id } = limitedStore.add(["mcp:read", "mcp:autonomy:execute", "mcp:discovery:run", "mcp:grants:create"], "limited-token");
        const limitedPolicy = { ...policy, id: "policy-limited", token_id: id, allowed_tools: ["run_autonomous_grant_ops_cycle"] };
        const limitedAdapter = createMcpAdapter({ createRepository: () => repository, createRegistry: createToolRegistry, resolveAgentToken: limitedStore.resolveAgentToken, updateAgentTokenLastUsed: limitedStore.updateAgentTokenLastUsed, autonomyStore: makeAutonomyStore(limitedPolicy), serviceRoleKey: null });
        const result = await limitedAdapter.handleCall({ authorization: `Bearer ${plaintext}` }, { name: "run_autonomous_grant_ops_cycle", arguments: { candidates: [], dryRun: false, idempotencyKey: "limited-cycle-1" } });
        assert(result.status === 403, JSON.stringify(result.body));
        assert(result.body.requiredScope === "mcp:grants:archive", "expected missing archive scope first");
      },
    },
    {
      name: "dangerous submission and deletion tools remain blocked",
      fn: async () => {
        for (const name of ["submit_application_externally", "send_outreach", "delete_record", "approve_agent_knowledge_update"]) {
          const result = await adapter.handleCall(headers(), { name, arguments: { dryRun: false, idempotencyKey: `blocked-${name}` } });
          assert(result.status === 403, `${name} was not blocked: ${JSON.stringify(result.body)}`);
          assert(JSON.stringify(result.body).includes("unsupported_operation"), `${name} missing unsupported_operation`);
        }
      },
    },
    {
      name: "policy rejects expiry, daily limit, and oversized batches",
      fn: async () => {
        const expired = checkAutonomyPolicy({ ...policy, expires_at: "2026-01-01T00:00:00.000Z" }, { writesToday: 0 }, "create_grant", { candidate }, new Date("2026-08-10T00:00:00.000Z"));
        assert(!expired.allowed && expired.code === "autonomy_policy_expired", "expired policy not rejected");
        const limited = checkAutonomyPolicy(policy, { writesToday: 100 }, "create_grant", { candidate });
        assert(!limited.allowed && limited.code === "rate_limit_exceeded", "daily limit not enforced");
        const oversized = checkAutonomyPolicy({ ...policy, max_batch_size: 1 }, { writesToday: 0 }, "bulk_upsert_grants_from_sources", { candidates: [candidate, candidate] });
        assert(!oversized.allowed && oversized.code === "batch_limit_exceeded", "batch limit not enforced");
      },
    },
    {
      name: "migration enforces RLS, ownership, replay, and database-side autonomy limits",
      fn: async () => {
        const migration = readFileSync(new URL("../supabase/migrations/022_agent_autonomous_grant_ops.sql", import.meta.url), "utf8");
        for (const table of ["agent_autonomy_policies", "agent_discovery_runs", "agent_autonomy_events"]) {
          assert(migration.includes(`alter table public.${table} enable row level security`), `${table} RLS missing`);
        }
        assert(migration.includes("foreign key (token_id, user_id)"), "token-owner composite foreign key missing");
        assert(migration.includes("foreign key (policy_id, token_id, user_id)"), "event-policy identity foreign key missing");
        assert(migration.includes("unique (token_id, idempotency_key)"), "durable replay constraint missing");
        assert(migration.includes("pg_advisory_xact_lock"), "concurrent daily-limit serialization missing");
        assert(migration.includes("autonomy_daily_limit_reached"), "database-side daily limit missing");
        assert(!/create policy[^;]+on public\.(grants|applications|tasks)/is.test(migration), "operational RLS policy was modified");
        assert(!/for\s+(insert|delete)\s+to authenticated/i.test(migration), "client insert/delete policy must not exist");
        for (const blocked of ["delete_record", "submit_application_externally", "send_outreach", "approve_agent_knowledge_update"]) {
          assert(migration.includes(blocked), `database guard missing for ${blocked}`);
        }
      },
    },
  ];

  const results: TestResult[] = [];
  for (const test of cases) {
    try { await test.fn(); results.push({ name: test.name, passed: true }); console.log(`PASS ${test.name}`); }
    catch (error) { const message = error instanceof Error ? error.message : String(error); results.push({ name: test.name, passed: false, error: message }); console.error(`FAIL ${test.name}: ${message}`); }
  }
  const failed = results.filter((result) => !result.passed);
  console.log(`\nSummary: ${results.length - failed.length} passed, ${failed.length} failed, 0 skipped`);
  console.log("Real database touched: NO");
  if (failed.length) process.exitCode = 1;
}

await run();
