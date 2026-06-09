import { createToolRegistry } from "../src/lib/agent-tools/registry";
import type { GrantOsRepository } from "../src/lib/agent-tools/repository";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";
import {
  assertNormalUserAccessToken,
  describeAgentAuthContext,
  getAgentAuthMode,
  isToolAllowedForAgentContext,
  maskSecret,
  type AgentAuthContext,
} from "../src/lib/agent-tools/authContext";
import type { GrantRow } from "../src/types/database";

type TestResult = { name: string; passed: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function humanityGrantFrom(template: GrantRow): GrantRow {
  return {
    ...template,
    id: "28d81882-64c1-4677-84d5-7c9303ef2a58",
    title: "Humanity AI",
    funder_name: "Humanity AI Foundation",
    archived_at: null,
  };
}

function createMockPolicyRepository(authContext?: AgentAuthContext) {
  const base = createInMemoryGrantOsRepository();
  const visible = getAgentAuthMode(authContext) === "authenticated";
  const humanityGrant = humanityGrantFrom(base.snapshot().grants[0]);

  const repository: GrantOsRepository & ReturnType<typeof createInMemoryGrantOsRepository> = {
    ...base,
    async listGrants() {
      if (!visible) return [];
      return [...base.snapshot().grants.filter((grant) => !grant.archived_at), humanityGrant];
    },
    async getGrant(id) {
      if (!visible) return null;
      if (id === humanityGrant.id) return humanityGrant;
      return base.getGrant(id);
    },
  };

  return repository;
}

async function run() {
  const anonymousContext: AgentAuthContext = {
    actorType: "cli",
    source: "simulation-anonymous",
  };
  const authenticatedContext: AgentAuthContext = {
    actorType: "delegated_agent",
    source: "simulation-authenticated",
    userId: "user-1",
    userAccessToken: "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature",
    allowedTools: ["list_grants", "search_grants", "get_grant"],
    expiresAt: "2026-06-09T12:00:00.000Z",
  };

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "anonymous context sees protected grants as denied or empty",
      fn: async () => {
        const repo = createMockPolicyRepository(anonymousContext);
        const registry = createToolRegistry({ repository: repo, actor: { type: "agent", id: "anonymous-sim", source: "external_agent" } });
        const result = await registry.execute("search_grants", { query: "Humanity AI" });
        assert(result.ok, "anonymous search should return a structured empty result");
        assert(result.data.total === 0, "anonymous context should not see protected grant rows");
      },
    },
    {
      name: "authenticated context can read protected grant rows",
      fn: async () => {
        const repo = createMockPolicyRepository(authenticatedContext);
        const registry = createToolRegistry({ repository: repo, actor: { type: "agent", id: "authenticated-sim", source: "external_agent" } });
        const result = await registry.execute("search_grants", { query: "Humanity AI" });
        assert(result.ok, "authenticated search should succeed");
        assert(result.data.total === 1, "authenticated context should see Humanity AI");
        assert(result.data.items[0].id === "28d81882-64c1-4677-84d5-7c9303ef2a58", "wrong Humanity AI grant id");
      },
    },
    {
      name: "token value is never included in auth description or audit payload",
      fn: async () => {
        const repo = createMockPolicyRepository(authenticatedContext);
        const registry = createToolRegistry({ repository: repo, actor: { type: "agent", id: "authenticated-sim", source: "external_agent" } });
        await registry.execute("list_grants", {});
        const serializedAudit = JSON.stringify(repo.auditTrail());
        const serializedDescription = JSON.stringify(describeAgentAuthContext(authenticatedContext));
        assert(!serializedAudit.includes(authenticatedContext.userAccessToken!), "audit payload leaked raw token");
        assert(!serializedDescription.includes(authenticatedContext.userAccessToken!), "auth description leaked raw token");
        assert(maskSecret(authenticatedContext.userAccessToken) !== authenticatedContext.userAccessToken, "maskSecret returned raw token");
      },
    },
    {
      name: "tool scope metadata exists",
      fn: async () => {
        assert(isToolAllowedForAgentContext("search_grants", authenticatedContext), "allowed read tool should be in scope");
        assert(!isToolAllowedForAgentContext("create_application_from_grant", authenticatedContext), "write tool should not be in scoped read context");
        const description = describeAgentAuthContext(authenticatedContext);
        assert(Array.isArray(description.allowedTools), "auth description should include allowedTools metadata");
      },
    },
    {
      name: "safe-write tools still default to dryRun true",
      fn: async () => {
        const repo = createInMemoryGrantOsRepository();
        const registry = createToolRegistry({ repository: repo, actor: { type: "agent", id: "write-sim", source: "external_agent" } });
        const before = repo.snapshot();
        const result = await registry.execute("create_task", { title: "Draft a memo" });
        const after = repo.snapshot();
        assert(result.ok, "create_task dry-run should succeed");
        assert(result.data.dryRun === true, "create_task should default to dryRun true");
        assert(JSON.stringify(before.tasks) === JSON.stringify(after.tasks), "default dry-run mutated tasks");
      },
    },
    {
      name: "approval-required tools still never execute",
      fn: async () => {
        const repo = createInMemoryGrantOsRepository();
        const registry = createToolRegistry({ repository: repo, actor: { type: "agent", id: "approval-sim", source: "external_agent" } });
        const before = repo.snapshot();
        const result = await registry.execute("archive_record", { recordType: "grant", recordId: "grant-1", reason: "simulation" });
        const after = repo.snapshot();
        assert(result.ok, "archive_record should return approval payload");
        assert(result.data.requires_approval === true, "archive_record should require approval");
        assert(JSON.stringify(before.grants) === JSON.stringify(after.grants), "approval-required tool mutated grants");
      },
    },
    {
      name: "service-role JWTs are rejected by CLI auth guard",
      fn: async () => {
        let rejected = false;
        try {
          assertNormalUserAccessToken("eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature");
        } catch {
          rejected = true;
        }
        assert(rejected, "service_role token should be rejected");
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

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  console.log("Grant OS Agent Auth Simulations");
  console.log("Mode: mocked policy / no real Supabase reads or writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");

  if (failed > 0) process.exit(1);
}

void run();
