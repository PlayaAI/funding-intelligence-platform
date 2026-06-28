/**
 * agent-mcp-deadline-simulations.ts — V2.11I
 *
 * Tests for Deadline-Aware Recommendation Consistency in Grant OS MCP.
 * Mode: in-memory repository.
 */

import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";
import type { AgentApiClient } from "../src/lib/agent-mcp/client";

type TestResult = { name: string; passed: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function base64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fakeJwt(payload: Record<string, unknown>): string {
  return [base64Url(JSON.stringify({ alg: "none", typ: "JWT" })), base64Url(JSON.stringify(payload)), "signature"].join(".");
}

const expiredDate = new Date();
expiredDate.setDate(expiredDate.getDate() - 10);
const upcomingDate = new Date();
upcomingDate.setDate(upcomingDate.getDate() + 10);
const todayDate = new Date();

async function run() {
  console.log("Starting V2.11I agent MCP deadline simulation tests...\n");

  const adminJwt = fakeJwt({ role: "authenticated", app_role: "Admin", sub: "admin-1" });

  const repository = createInMemoryGrantOsRepository({
    grants: [
      { id: "grant-expired", title: "Expired Grant", deadline: expiredDate.toISOString().split("T")[0], application_url: "http://example.com" } as any,
      { id: "grant-upcoming", title: "Upcoming Grant", deadline: upcomingDate.toISOString().split("T")[0], application_url: "http://example.com" } as any,
      { id: "grant-unknown", title: "Unknown Grant", deadline: null, application_url: "http://example.com" } as any,
    ],
    projects: [{ id: "proj-1", name: "Project 1" } as any],
    proofItems: [{ id: "proof-1", project_id: "proj-1" } as any],
    grantMatches: [
      { id: "m1", grant_id: "grant-expired", project_id: "proj-1", match_score: 95, decision_label: "apply_now", fit_reasons: [] } as any,
      { id: "m2", grant_id: "grant-upcoming", project_id: "proj-1", match_score: 85, decision_label: "apply_now", fit_reasons: [] } as any,
      { id: "m3", grant_id: "grant-unknown", project_id: "proj-1", match_score: 75, decision_label: "needs_review", fit_reasons: [] } as any,
    ],
  });

  const mcp = createMcpAdapter({
    createRepository: () => repository,
    createRegistry: createToolRegistry,
  });

  async function callMcp(tool: string, input: any) {
    const result = await mcp.handleCall(
      { authorization: `Bearer ${adminJwt}`, "x-forwarded-for": "127.0.0.1" },
      { name: tool, arguments: input }
    );
    return result as any;
  }

  const tests: { name: string; fn: () => Promise<void> }[] = [
    {
      name: "V2.11I: get_grant_decision_brief returns missed_deadline for expired grant",
      fn: async () => {
        const result = await callMcp("get_grant_decision_brief", { grantId: "grant-expired", projectId: "proj-1" });
        assert(result.status === 200, "expected 200");
        const json = result.body.content[0].json.data;
        assert(json.urgency.deadline_status === "expired", "deadline_status should be expired");
        assert(json.recommendation === "missed_deadline", "recommendation should be overridden to missed_deadline");
      },
    },
    {
      name: "V2.11I: list_grant_matches overrides decision_label for expired grant",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { grantId: "grant-expired" });
        assert(result.status === 200, "expected 200");
        const json = result.body.content[0].json.data;
        const item = json.items.find((i: any) => i.grant_id === "grant-expired");
        assert(item.deadline_status === "expired", "should inject expired status");
        assert(item.original_decision_label === "apply_now", "should preserve original decision");
        assert(item.decision_label === "missed_deadline", "should override to missed_deadline");
      },
    },
    {
      name: "V2.11I: list_grant_matches deadlineFilter=active (fallback)",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { grantId: "grant-expired", deadlineFilter: "active" });
        const json = result.body.content[0].json.data;
        assert(json.items.length === 1, "should fallback and return the expired match");
        assert(json.note?.includes("showing expired matches for reference"), "should include fallback note");
      },
    },
    {
      name: "V2.11I: list_grant_matches sorts upcoming before expired despite score",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { projectId: "proj-1", deadlineFilter: "all" });
        const json = result.body.content[0].json.data;
        assert(json.items.length === 3, "should return all matches");
        // upcoming (score 85) should be before expired (score 95)
        assert(json.items[0].grant_id === "grant-upcoming", "upcoming should be first");
        assert(json.items[1].grant_id === "grant-unknown", "unknown should be second (active)");
        assert(json.items[2].grant_id === "grant-expired", "expired should be last");
      },
    },
    {
      name: "V2.11I: upcoming grant can still return apply_now",
      fn: async () => {
        const result = await callMcp("get_grant_decision_brief", { grantId: "grant-upcoming", projectId: "proj-1" });
        const json = result.body.content[0].json.data;
        assert(json.urgency.deadline_status === "upcoming", "should be upcoming");
        assert(json.recommendation === "apply_now", "should retain apply_now");
      },
    },
  ];

  const results: TestResult[] = [];
  for (const test of tests) {
    try {
      await test.fn();
      results.push({ name: test.name, passed: true });
      console.log(`✅ ${test.name}`);
    } catch (err) {
      results.push({ name: test.name, passed: false, error: String(err) });
      console.error(`❌ ${test.name}`);
      console.error(`   ${err}`);
    }
  }

  const failures = results.filter((r) => !r.passed);
  console.log(`\nResults: ${results.length - failures.length} / ${results.length} passed.`);
  if (failures.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled simulation error:", err);
  process.exit(1);
});
