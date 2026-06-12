import { createAgentApi } from "../src/lib/agent-api/agentApi";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";
import type { AgentAuthContext } from "../src/lib/agent-tools/authContext";
import type { GrantOsRepository } from "../src/lib/agent-tools/repository";

type TestResult = { name: string; passed: boolean; error?: string };

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
  let repositoryCreated = 0;
  const api = createAgentApi({
    createRepository: (_authContext: AgentAuthContext) => {
      repositoryCreated += 1;
      return createInMemoryGrantOsRepository();
    },
    getProjectRef: () => "abcdefghijklmnopqrst",
  });

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "missing auth returns 401-style error",
      fn: async () => {
        const result = await api.handleTool({}, { tool: "list_grants", input: {} });
        assert(result.status === 401, "expected 401 status");
        assert(result.body.ok === false, "expected failed response");
      },
    },
    {
      name: "malformed auth returns 401-style error",
      fn: async () => {
        const result = await api.handleTool({ authorization: "Bearer not-a-jwt" }, { tool: "list_grants", input: {} });
        assert(result.status === 401, "expected 401 status");
        assert(JSON.stringify(result.body).includes("malformed_authorization"), "expected malformed error");
      },
    },
    {
      name: "service-role-looking JWT is rejected",
      fn: async () => {
        const result = await api.handleTool(authHeaders(serviceRoleToken), { tool: "list_grants", input: {} });
        assert(result.status === 401, "expected 401 status");
        assert(JSON.stringify(result.body).includes("service_role_rejected"), "expected service role rejection");
      },
    },
    {
      name: "read tool is allowed",
      fn: async () => {
        const result = await api.handleTool(authHeaders(), { tool: "list_grants", input: { limit: 1 } });
        assert(result.status === 200, "expected success status");
        assert(result.body.ok === true, "expected ok response");
        const data = result.body.data as { items?: unknown[] };
        assert(Array.isArray(data.items) && data.items.length === 1, "expected one listed grant");
      },
    },
    {
      name: "write_safe tool is blocked",
      fn: async () => {
        const result = await api.handleTool(authHeaders(), { tool: "create_task", input: { title: "Should Not Create" } });
        assert(result.status === 403, "expected forbidden status");
        assert(JSON.stringify(result.body).includes("tool_not_allowed"), "expected allowlist error");
      },
    },
    {
      name: "approval_required tool is blocked",
      fn: async () => {
        const result = await api.handleTool(authHeaders(), { tool: "archive_record", input: { recordType: "grant", recordId: "grant-1", reason: "test" } });
        assert(result.status === 403, "expected forbidden status");
        assert(JSON.stringify(result.body).includes("tool_not_allowed"), "expected allowlist error");
      },
    },
    {
      name: "search_grants request body is routed correctly",
      fn: async () => {
        const result = await api.handleTool(authHeaders(), { tool: "search_grants", input: { query: "MIT" } });
        assert(result.status === 200, "expected success status");
        const data = result.body.data as { query?: string; items?: Array<{ title?: string }> };
        assert(data.query === "MIT", "expected query to pass through");
        assert(data.items?.[0]?.title === "MIT Solve Challenge", "expected MIT grant result");
      },
    },
    {
      name: "token is not included in logs/audit payload",
      fn: async () => {
        const result = await api.handleTool(authHeaders(), { tool: "search_grants", input: { query: "MIT" } });
        assert(result.status === 200, "expected success status");
        assert(!JSON.stringify(result.body).includes(userToken), "response leaked token value");
      },
    },
    {
      name: "doctor response shape is safe",
      fn: async () => {
        process.env.GRANT_OS_TEST_SECRET = "super-secret-should-not-leak";
        const result = await api.handleDoctor(authHeaders());
        delete process.env.GRANT_OS_TEST_SECRET;
        assert(result.status === 200, "expected success status");
        assert(result.body.ok === true, "expected ok doctor response");
        assert(!JSON.stringify(result.body).includes(userToken), "doctor leaked token value");
        assert(!JSON.stringify(result.body).includes("super-secret-should-not-leak"), "doctor leaked secret-looking env value");
        const supabase = result.body.supabase as { projectRef?: string };
        const grants = result.body.grants as { visibleCount?: number; firstThreeTitles?: unknown[]; humanityAiVisible?: boolean };
        const deployment = result.body.deployment as {
          app?: string;
          commit?: string;
          commitFull?: string | null;
          versionSource?: string;
          environment?: string;
          apiSurface?: string;
          capabilities?: unknown[];
        };
        assert(supabase.projectRef === "abcd...qrst", "expected masked project ref");
        assert(typeof grants.visibleCount === "number", "expected visible count");
        assert(Array.isArray(grants.firstThreeTitles), "expected first titles array");
        assert(typeof grants.humanityAiVisible === "boolean", "expected humanity visibility flag");
        assert(deployment.app === "grant-os", "expected deployment app");
        assert(typeof deployment.commit === "string" && deployment.commit.length > 0, "expected deployment commit");
        assert(typeof deployment.versionSource === "string" && deployment.versionSource.length > 0, "expected deployment version source");
        assert(typeof deployment.environment === "string" && deployment.environment.length > 0, "expected deployment environment");
        assert(deployment.apiSurface === "v2.3A", "expected api surface version");
        assert(Array.isArray(deployment.capabilities) && deployment.capabilities.includes("mcp_http_adapter"), "expected deployment capabilities");
      },
    },
    {
      name: "blocked tool does not call repository mutation",
      fn: async () => {
        let createTaskCalls = 0;
        const guardedApi = createAgentApi({
          createRepository: () => {
            const repo = createInMemoryGrantOsRepository() as GrantOsRepository;
            return {
              ...repo,
              async createTask(input) {
                createTaskCalls += 1;
                return repo.createTask(input);
              },
            };
          },
        });
        const result = await guardedApi.handleTool(authHeaders(), { tool: "create_task", input: { title: "Should Not Create" } });
        assert(result.status === 403, "expected forbidden status");
        assert(createTaskCalls === 0, "blocked hosted tool called createTask");
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

  console.log("Grant OS Agent API Simulations");
  console.log("Mode: in-memory / no real Supabase reads or writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");
  console.log(`Repositories created: ${repositoryCreated}`);

  if (failed > 0) process.exit(1);
}

void run();
