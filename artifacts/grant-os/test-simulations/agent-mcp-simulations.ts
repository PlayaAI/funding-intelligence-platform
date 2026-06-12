import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";
import type { AgentApiClient } from "../src/lib/agent-mcp/client";

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
  const repository = createInMemoryGrantOsRepository();
  const forwardedCalls: Array<{ kind: "doctor" }> = [];
  const upstream: AgentApiClient = {
    async doctor(_headers) {
      forwardedCalls.push({ kind: "doctor" });
      return {
        status: 200,
        body: {
          ok: true,
          grants: { visibleCount: 270, humanityAiVisible: true },
          auth: { mode: "authenticated", userAccessTokenPresent: true },
          deployment: {
            app: "grant-os",
            commit: "c2869a6",
            commitFull: "c2869a6ca769fd8f4aedcb1c8ecece3e56d02a73",
            versionSource: "git",
            environment: "preview",
            apiSurface: "v2.3A",
            capabilities: ["agent_api", "mcp_http_adapter", "safe_write_dry_run", "grant_match_generation"],
          },
        },
      };
    },
    async tool() {
      throw new Error("tool forwarding is not used in V2.3A adapter tests");
    },
  };

  const adapter = createMcpAdapter({
    upstreamClient: upstream,
    createRepository: () => repository,
    createRegistry: createToolRegistry,
  });

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "missing auth rejected",
      fn: async () => {
        const result = await adapter.handleTools({});
        assert(result.status === 401, "expected 401 status");
        assert(result.body.ok === false, "expected failed response");
      },
    },
    {
      name: "malformed auth rejected",
      fn: async () => {
        const result = await adapter.handleTools({ authorization: "Bearer not-a-jwt" });
        assert(result.status === 401, "expected 401 status");
        assert(JSON.stringify(result.body).includes("malformed_authorization"), "expected malformed auth error");
      },
    },
    {
      name: "service-role-looking auth rejected",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders(serviceRoleToken));
        assert(result.status === 401, "expected 401 status");
        assert(JSON.stringify(result.body).includes("service_role_rejected"), "expected service role rejection");
      },
    },
    {
      name: "tools list includes read and safe write tools",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        assert(result.status === 200, "expected success status");
        const tools = (result.body.tools ?? []) as Array<{ name?: string; permissionLevel?: string }>;
        assert(tools.some((tool) => tool.name === "search_grants" && tool.permissionLevel === "read"), "expected search_grants read tool");
        assert(tools.some((tool) => tool.name === "create_task" && tool.permissionLevel === "write_safe"), "expected create_task write_safe tool");
      },
    },
    {
      name: "archive_record returns approval_required_or_not_enabled",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "archive_record",
          arguments: { recordType: "grant", recordId: "grant-1", reason: "test" },
        });
        assert(result.status === 403, "expected forbidden status");
        assert(JSON.stringify(result.body).includes("approval_required_or_not_enabled"), "expected approval_required_or_not_enabled error");
      },
    },
    {
      name: "search_grants call succeeds",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "search_grants",
          arguments: { query: "MIT" },
        });
        assert(result.status === 200, "expected success status");
        assert(result.body.ok === true, "expected ok response");
        const content = (result.body.content ?? []) as Array<{ type?: string; json?: { data?: { items?: Array<{ title?: string }> } } }>;
        assert(content[0]?.type === "json", "expected json content item");
        assert(Array.isArray(content[0]?.json?.data?.items), "expected search results array");
      },
    },
    {
      name: "doctor forwards safely",
      fn: async () => {
        const result = await adapter.handleDoctor(authHeaders());
        assert(result.status === 200, "expected success status");
        assert(result.body.ok === true, "expected ok doctor response");
        assert(forwardedCalls.at(-1)?.kind === "doctor", "expected doctor call to forward upstream");
        assert(!JSON.stringify(result.body).includes(userToken), "doctor response leaked token");
        const deployment = result.body.deployment as { app?: string; apiSurface?: string; capabilities?: unknown[] };
        assert(deployment.app === "grant-os", "expected deployment app");
        assert(deployment.apiSurface === "v2.3A", "expected deployment api surface");
        assert(Array.isArray(deployment.capabilities) && deployment.capabilities.includes("safe_write_dry_run"), "expected deployment capabilities");
      },
    },
    {
      name: "token is not included in response",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "search_grants",
          arguments: { query: "MIT" },
        });
        assert(!JSON.stringify(result.body).includes(userToken), "response leaked token value");
      },
    },
    {
      name: "no DB mutation/live DB dependency",
      fn: async () => {
        assert(repository.snapshot().tasks.length === 1, "expected no write mutation during smoke tests");
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

  console.log("Grant OS Agent MCP Simulations");
  console.log("Mode: in-memory repository / no real Supabase reads or writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");
  console.log(`Forwarded doctor calls: ${forwardedCalls.length}`);

  if (failed > 0) process.exit(1);
}

void run();
