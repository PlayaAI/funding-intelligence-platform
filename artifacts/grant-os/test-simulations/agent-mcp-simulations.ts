import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import type { AgentApiClient } from "../src/lib/agent-mcp/client";

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
  const forwardedCalls: Array<{ kind: "doctor" | "tool"; body?: JsonRecord }> = [];
  const upstream: AgentApiClient = {
    async doctor(_headers) {
      forwardedCalls.push({ kind: "doctor" });
      return {
        status: 200,
        body: {
          ok: true,
          grants: { visibleCount: 270, humanityAiVisible: true },
          auth: { mode: "authenticated", userAccessTokenPresent: true },
        },
      };
    },
    async tool(_headers, body) {
      forwardedCalls.push({ kind: "tool", body: body as JsonRecord });
      return {
        status: 200,
        body: {
          ok: true,
          tool: "search_grants",
          data: {
            items: [{ id: "grant-1", title: "Humanity AI Open Call" }],
            total: 1,
            query: (body as { input?: { query?: string } }).input?.query ?? null,
          },
          audit: { tool_name: "search_grants", actor_id: "user-123" },
        },
      };
    },
  };

  const adapter = createMcpAdapter({ upstreamClient: upstream });

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
      name: "tools list only includes read tools",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        assert(result.status === 200, "expected success status");
        const tools = (result.body.tools ?? []) as Array<{ permissionLevel?: string }>;
        assert(tools.length > 0, "expected non-empty tool list");
        assert(tools.every((tool) => tool.permissionLevel === "read"), "expected only read tools");
      },
    },
    {
      name: "tools list does not include create_task",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        const tools = (result.body.tools ?? []) as Array<{ name?: string }>;
        assert(!tools.some((tool) => tool.name === "create_task"), "create_task should not be listed");
      },
    },
    {
      name: "search_grants call forwards correctly",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "search_grants",
          arguments: { query: "Humanity AI" },
        });
        assert(result.status === 200, "expected success status");
        assert(result.body.ok === true, "expected ok response");
        const lastCall = forwardedCalls.at(-1);
        assert(lastCall?.kind === "tool", "expected tool call to be forwarded");
        assert(lastCall.body?.tool === "search_grants", "expected forwarded tool name");
        const input = lastCall.body?.input as { query?: string } | undefined;
        assert(input?.query === "Humanity AI", "expected forwarded query");
        const content = (result.body.content ?? []) as Array<{ type?: string; json?: { data?: { items?: Array<{ title?: string }> } } }>;
        assert(content[0]?.type === "json", "expected json content item");
        assert(content[0]?.json?.data?.items?.[0]?.title === "Humanity AI Open Call", "expected Humanity AI result");
      },
    },
    {
      name: "create_task returns tool_not_allowed",
      fn: async () => {
        const countBefore = forwardedCalls.length;
        const result = await adapter.handleCall(authHeaders(), {
          name: "create_task",
          arguments: { title: "Should Not Create" },
        });
        assert(result.status === 403, "expected forbidden status");
        assert(JSON.stringify(result.body).includes("tool_not_allowed"), "expected tool_not_allowed error");
        assert(forwardedCalls.length === countBefore, "blocked tool should not forward upstream");
      },
    },
    {
      name: "doctor forwards safely",
      fn: async () => {
        const result = await adapter.handleDoctor(authHeaders());
        assert(result.status === 200, "expected success status");
        assert(result.body.ok === true, "expected ok doctor response");
        const lastCall = forwardedCalls.at(-1);
        assert(lastCall?.kind === "doctor", "expected doctor call to forward upstream");
        assert(!JSON.stringify(result.body).includes(userToken), "doctor response leaked token");
      },
    },
    {
      name: "token is not included in response",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "search_grants",
          arguments: { query: "Humanity AI" },
        });
        assert(!JSON.stringify(result.body).includes(userToken), "response leaked token value");
      },
    },
    {
      name: "no DB mutation/live DB dependency",
      fn: async () => {
        assert(forwardedCalls.every((call) => call.kind === "doctor" || call.body?.tool === "search_grants"), "unexpected forwarded mutation tool");
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
  console.log("Mode: stubbed upstream / no real Supabase reads or writes\n");
  for (const result of results) {
    console.log(`${result.passed ? "✅" : "❌"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
  }
  console.log("\nSummary:");
  console.log(`${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");
  console.log(`Forwarded calls: ${forwardedCalls.length}`);

  if (failed > 0) process.exit(1);
}

void run();
