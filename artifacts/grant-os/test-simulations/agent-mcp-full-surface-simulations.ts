import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";

type TestResult = { name: string; passed: boolean; error?: string };
type JsonRecord = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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

const userToken = fakeJwt({ role: "authenticated", sub: "user-123" });
const serviceRoleToken = fakeJwt({ role: "service_role", sub: "service" });

function authHeaders(token = userToken) {
  return { authorization: `Bearer ${token}` };
}

async function run() {
  const repository = createInMemoryGrantOsRepository();
  const adapter = createMcpAdapter({
    createRepository: () => repository,
    createRegistry: createToolRegistry,
  });

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "read tools still listed",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        assert(result.status === 200, "expected success status");
        const tools = (result.body.tools ?? []) as Array<{ name?: string }>;
        assert(tools.some((tool) => tool.name === "search_grants"), "expected search_grants in manifest");
        assert(tools.some((tool) => tool.name === "get_dashboard_summary"), "expected get_dashboard_summary in manifest");
      },
    },
    {
      name: "safe write tools are listed with permissionLevel write_safe",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        const tools = (result.body.tools ?? []) as Array<{ name?: string; permissionLevel?: string; defaultDryRun?: boolean; enabled?: boolean }>;
        const createTask = tools.find((tool) => tool.name === "create_task");
        assert(createTask?.permissionLevel === "write_safe", "expected create_task write_safe");
        assert(createTask?.defaultDryRun === true, "expected create_task defaultDryRun true");
        assert(createTask?.enabled === true, "expected create_task enabled");
      },
    },
    {
      name: "dangerous approval-required tools are not directly callable",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "archive_record",
          arguments: { recordType: "grant", recordId: "grant-1", reason: "test" },
        });
        assert(result.status === 403, "expected forbidden status");
        assert(JSON.stringify(result.body).includes("approval_required_or_not_enabled"), "expected structured blocked error");
      },
    },
    {
      name: "create_task defaults to dryRun true",
      fn: async () => {
        const before = repository.snapshot().tasks.length;
        const result = await adapter.handleCall(authHeaders(), {
          name: "create_task",
          arguments: { applicationId: "app-1", title: "Draft narrative outline" },
        });
        assert(result.status === 200, "expected success status");
        const body = result.body as {
          dryRun?: boolean;
          mutationPerformed?: boolean | null;
          content?: Array<{ json?: { data?: { dryRun?: boolean; mutationPerformed?: boolean; wouldTouchRealDb?: boolean; targetPersistenceTables?: string[] } } }>;
        };
        assert(body.dryRun === true, "expected top-level dryRun true");
        assert(body.mutationPerformed === false, "expected top-level mutationPerformed false");
        assert(body.content?.[0]?.json?.data?.dryRun === true, "expected tool result dryRun true");
        assert(body.content?.[0]?.json?.data?.mutationPerformed === false, "expected tool result mutationPerformed false");
        assert(body.content?.[0]?.json?.data?.wouldTouchRealDb === true, "expected wouldTouchRealDb true for dry-run write");
        assert(body.content?.[0]?.json?.data?.targetPersistenceTables?.includes("tasks"), "expected targetPersistenceTables to include tasks");
        assert(repository.snapshot().tasks.length === before, "dry-run should not mutate tasks");
      },
    },
    {
      name: "create_task with dryRun true forwards correctly",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "create_task",
          arguments: { applicationId: "app-1", title: "Draft checklist", dryRun: true },
        });
        assert(result.status === 200, "expected success status");
        const content = (result.body.content ?? []) as Array<{ json?: { data?: { plannedMutation?: { values?: { title?: string } } } } }>;
        assert(content[0]?.json?.data?.plannedMutation?.values?.title === "Draft checklist", "expected planned mutation title");
      },
    },
    {
      name: "create_task with dryRun false forwards only when explicitly provided",
      fn: async () => {
        const before = repository.snapshot().tasks.length;
        const result = await adapter.handleCall(authHeaders(), {
          name: "create_task",
          arguments: { applicationId: "app-1", title: "Real task", dryRun: false },
        });
        assert(result.status === 200, "expected success status");
        const body = result.body as { dryRun?: boolean; content?: Array<{ json?: { data?: { task?: { title?: string } } } }> };
        assert(body.dryRun === false, "expected top-level dryRun false");
        assert(body.content?.[0]?.json?.data?.task?.title === "Real task", "expected created task title");
        assert(repository.snapshot().tasks.length === before + 1, "real write should add one task");
      },
    },
    {
      name: "blocked dangerous tool returns structured error",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "run_scraping_job",
          arguments: { target: "https://example.org" },
        });
        assert(result.status === 403, "expected forbidden status");
        const blocked = result.body.blocked as boolean | undefined;
        const error = (result.body.error ?? {}) as { code?: string; message?: string };
        assert(blocked === true, "expected blocked true");
        assert(error.code === "approval_required_or_not_enabled", "expected approval_required_or_not_enabled code");
        assert(typeof error.message === "string" && error.message.length > 0, "expected error message");
      },
    },
    {
      name: "match-generation tool appears in manifest",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        const tools = (result.body.tools ?? []) as Array<{ name?: string; permissionLevel?: string; defaultDryRun?: boolean }>;
        const tool = tools.find((entry) => entry.name === "generate_grant_match");
        assert(tool?.permissionLevel === "write_safe", "expected generate_grant_match write_safe");
        assert(tool?.defaultDryRun === true, "expected generate_grant_match defaultDryRun true");
      },
    },
    {
      name: "generate_grant_match returns structured output or clear not-implemented persistence response",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "generate_grant_match",
          arguments: { grantId: "grant-1", projectId: "project-1" },
        });
        assert(result.status === 200, "expected success status");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        assert(typeof data.grantId === "string", "expected grantId");
        assert(typeof data.projectId === "string", "expected projectId");
        assert(typeof data.fitScore === "number", "expected fitScore");
        assert(typeof data.priorityScore === "number", "expected priorityScore");
        assert(Array.isArray(data.strengths), "expected strengths array");
        assert(Array.isArray(data.risks), "expected risks array");
        assert(Array.isArray(data.missingInfo), "expected missingInfo array");
      },
    },
    {
      name: "no token appears in output",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "create_task",
          arguments: { applicationId: "app-1", title: "Token leak check" },
        });
        assert(!JSON.stringify(result.body).includes(userToken), "response leaked token value");
      },
    },
    {
      name: "no test touches live DB",
      fn: async () => {
        const auditTrail = repository.auditTrail();
        assert(auditTrail.every((entry) => entry.actor_type === "agent"), "expected in-memory audit trail only");
      },
    },
    {
      name: "no service-role path",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders(serviceRoleToken));
        assert(result.status === 401, "expected service-role rejection status");
        assert(JSON.stringify(result.body).includes("service_role_rejected"), "expected service-role rejection");
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

  console.log("Grant OS Agent MCP Full Surface Simulations");
  console.log("Mode: in-memory repository / no real Supabase reads or writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");

  if (failed > 0) process.exit(1);
}

void run();
