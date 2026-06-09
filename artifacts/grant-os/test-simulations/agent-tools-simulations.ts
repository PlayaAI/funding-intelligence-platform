import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";

type TestResult = { name: string; passed: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  const repo = createInMemoryGrantOsRepository();
  const registry = createToolRegistry({ repository: repo, actor: { type: "agent", id: "simulation-agent", source: "external_agent" } });

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "list_grants returns active grants",
      fn: async () => {
        const result = await registry.execute("list_grants", { limit: 10 });
        assert(result.ok, "list_grants should succeed");
        assert(result.data.items.length === 2, "expected exactly 2 active grants");
      },
    },
    {
      name: "get_grant returns grant detail",
      fn: async () => {
        const result = await registry.execute("get_grant", { grantId: "grant-1" });
        assert(result.ok, "get_grant should succeed");
        assert(result.data.grant.title === "MIT Solve Challenge", "grant title mismatch");
      },
    },
    {
      name: "create_application_from_grant dry-run does not mutate",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("create_application_from_grant", { grantId: "grant-2", projectId: "project-1", dryRun: true });
        const after = repo.snapshot();
        assert(result.ok, "dry-run create_application_from_grant should succeed");
        assert(result.data.dryRun === true, "dry-run flag should be true");
        assert(JSON.stringify(before.applications) === JSON.stringify(after.applications), "dry-run mutated applications");
      },
    },
    {
      name: "create_application_from_grant non-dry-run creates in-memory application",
      fn: async () => {
        const result = await registry.execute("create_application_from_grant", { grantId: "grant-2", projectId: "project-1", dryRun: false });
        assert(result.ok, "create_application_from_grant should succeed");
        assert(result.data.created === true, "application should be created");
      },
    },
    {
      name: "duplicate application prevention works",
      fn: async () => {
        const result = await registry.execute("create_application_from_grant", { grantId: "grant-1", projectId: "project-1", dryRun: false });
        assert(result.ok, "duplicate prevention call should succeed");
        assert(result.data.created === false, "duplicate application should not be recreated");
      },
    },
    {
      name: "generate_application_checklist dry-run does not mutate",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("generate_application_checklist", { applicationId: "app-1", dryRun: true });
        const after = repo.snapshot();
        assert(result.ok, "generate_application_checklist dry-run should succeed");
        assert(result.data.dryRun === true, "expected dry-run result");
        assert(JSON.stringify(before.tasks) === JSON.stringify(after.tasks), "dry-run mutated tasks");
      },
    },
    {
      name: "generate_application_checklist runs once",
      fn: async () => {
        const first = await registry.execute("generate_application_checklist", { applicationId: "app-1", dryRun: false });
        const second = await registry.execute("generate_application_checklist", { applicationId: "app-1", dryRun: false });
        assert(first.ok && second.ok, "checklist executions should succeed");
        assert(first.data.createdTasks.length === second.data.createdTasks.length, "expected idempotent checklist generation");
      },
    },
    {
      name: "approval-required archive returns requires_approval",
      fn: async () => {
        const result = await registry.execute("archive_record", { recordType: "grant", recordId: "grant-1", reason: "test" });
        assert(result.ok, "archive_record should return structured approval response");
        assert(result.data.requires_approval === true, "archive_record should require approval");
        assert(Array.isArray(result.data.proposed_action.risks) && result.data.proposed_action.risks.length > 0, "archive_record approval payload should include risks");
      },
    },
    {
      name: "public tools do not expose private tables",
      fn: async () => {
        const result = await registry.execute("get_dashboard_summary", {});
        assert(result.ok, "get_dashboard_summary should succeed");
        assert(!("profiles" in result.data), "private table leaked through summary");
      },
    },
    {
      name: "export_application_packet shape is valid",
      fn: async () => {
        const result = await registry.execute("export_application_packet", { applicationId: "app-1" });
        assert(result.ok, "export_application_packet should succeed");
        assert(result.data.package_type === "application", "wrong export package type");
        assert(Array.isArray(result.data.records.tasks), "export packet missing tasks array");
      },
    },
    {
      name: "peer funding record tool works",
      fn: async () => {
        const result = await registry.execute("add_peer_funding_record", { peerOrganizationId: "peer-1", funderName: "Test Foundation", amount: 50000, awardYear: 2026, dryRun: false });
        assert(result.ok, "add_peer_funding_record should succeed");
        assert(result.data.record.funder_name === "Test Foundation", "peer funding record funder mismatch");
      },
    },
    {
      name: "audit payload generated",
      fn: async () => {
        await registry.execute("list_tasks", {});
        const auditTrail = repo.auditTrail();
        assert(auditTrail.length > 0, "expected audit trail entries");
        assert(Boolean(auditTrail[0].tool_name), "expected audit trail tool_name");
      },
    },
    {
      name: "errors return structured error objects",
      fn: async () => {
        const result = await registry.execute("get_grant", { grantId: "missing-grant" });
        assert(result.ok === false, "missing grant should fail");
        assert(typeof result.error.code === "string", "error code missing");
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

  console.log("Grant OS Agent Tools Simulations");
  console.log("Mode: in-memory / no real Supabase writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` — ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");

  if (failed > 0) process.exit(1);
}

void run();
