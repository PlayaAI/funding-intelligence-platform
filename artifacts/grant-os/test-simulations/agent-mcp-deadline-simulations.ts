/**
 * agent-mcp-deadline-simulations.ts — V2.11I (patched)
 *
 * Tests for Deadline-Aware Recommendation Consistency in Grant OS MCP.
 * Mode: in-memory repository.
 */

import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";

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

async function run() {
  console.log("Starting V2.11I (patched) agent MCP deadline simulation tests...\n");

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
      // expired grant with high score (95) and original label apply_now
      { id: "m1", grant_id: "grant-expired", project_id: "proj-1", match_score: 95, decision_label: "apply_now", fit_reasons: [] } as any,
      // upcoming grant
      { id: "m2", grant_id: "grant-upcoming", project_id: "proj-1", match_score: 85, decision_label: "apply_now", fit_reasons: [] } as any,
      // unknown deadline grant
      { id: "m3", grant_id: "grant-unknown", project_id: "proj-1", match_score: 75, decision_label: "needs_review", fit_reasons: [] } as any,
    ],
  });

  // Repo with ONLY expired matches — for deadlineFilter=active fallback test
  // Use replaceCollections to start with a clean slate for grants and matches
  const expiredOnlyRepo = createInMemoryGrantOsRepository({
    grants: [
      { id: "grant-expired-a", title: "Expired A", deadline: expiredDate.toISOString().split("T")[0], application_url: "http://example.com" } as any,
    ],
    projects: [{ id: "proj-1", name: "Project 1" } as any],
    proofItems: [{ id: "proof-1", project_id: "proj-1" } as any],
    grantMatches: [
      { id: "m1", grant_id: "grant-expired-a", project_id: "proj-1", match_score: 80, decision_label: "prepare_next", fit_reasons: [] } as any,
    ],
  }, ["grants", "grantMatches"]);

  const mcp = createMcpAdapter({ createRepository: () => repository, createRegistry: createToolRegistry });
  const mcpExpiredOnly = createMcpAdapter({ createRepository: () => expiredOnlyRepo, createRegistry: createToolRegistry });

  const authHdr = { authorization: `Bearer ${adminJwt}`, "x-forwarded-for": "127.0.0.1" };

  async function callMcp(tool: string, input: any, adapter = mcp) {
    const result = await adapter.handleCall(authHdr, { name: tool, arguments: input });
    return result as any;
  }

  const tests: { name: string; fn: () => Promise<void> }[] = [

    // ── 1. get_grant_decision_brief: expired → missed_deadline ────────────────
    {
      name: "V2.11I: get_grant_decision_brief returns missed_deadline for expired grant",
      fn: async () => {
        const result = await callMcp("get_grant_decision_brief", { grantId: "grant-expired", projectId: "proj-1" });
        assert(result.status === 200, `expected 200, got ${result.status}`);
        const json = result.body.content[0].json.data;
        assert(json.urgency.deadline_status === "expired", "deadline_status should be expired");
        assert(json.recommendation === "missed_deadline", `recommendation should be missed_deadline, got ${json.recommendation}`);
      },
    },

    // ── 2. Expired wins over missingInfo count (key bug fix) ──────────────────
    {
      name: "V2.11I: get_grant_decision_brief expired wins even when many fields are missing",
      fn: async () => {
        // grant-expired has no eligibility, no project-level match score on high-missing path
        const result = await callMcp("get_grant_decision_brief", { grantId: "grant-expired" });
        assert(result.status === 200, `expected 200, got ${result.status}`);
        const json = result.body.content[0].json.data;
        const forbidden = ["apply_now", "prepare_first", "prepare_next", "needs_review"];
        assert(json.recommendation === "missed_deadline",
          `expired must return missed_deadline regardless of missing fields, got ${json.recommendation}`);
        assert(!forbidden.includes(json.recommendation), `forbidden recommendation ${json.recommendation}`);
      },
    },

    // ── 3. list_grant_matches: decision_label overridden for expired ───────────
    {
      name: "V2.11I: list_grant_matches overrides decision_label for expired grant",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { grantId: "grant-expired" });
        assert(result.status === 200, "expected 200");
        const json = result.body.content[0].json.data;
        const item = json.items.find((i: any) => i.grant_id === "grant-expired");
        assert(item !== undefined, "expired grant match must appear");
        assert(item.deadline_status === "expired", "should inject expired status");
        assert(item.original_decision_label === "apply_now", "should preserve original decision");
        assert(item.decision_label === "missed_deadline", `should override to missed_deadline, got ${item.decision_label}`);
      },
    },

    // ── 4. deadlineFilter=active excludes expired (when actives exist) ─────────
    {
      name: "V2.11I: deadlineFilter=active excludes expired when active matches exist",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { projectId: "proj-1", deadlineFilter: "active" });
        const json = result.body.content[0].json.data;
        const expiredItems = json.items.filter((i: any) => i.deadline_status === "expired");
        assert(expiredItems.length === 0, `deadlineFilter=active should exclude expired, found ${expiredItems.length}`);
        assert(json.items.length >= 1, "should still return active/unknown matches");
      },
    },

    // ── 5. deadlineFilter=active fallback when ONLY expired matches exist ──────
    {
      name: "V2.11I: deadlineFilter=active fallback when only expired matches exist",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { deadlineFilter: "active" }, mcpExpiredOnly);
        const json = result.body.content[0].json.data;
        assert(json.items.length >= 1, "should fallback and return the expired match");
        assert(json.note?.includes("showing expired matches for reference"), `should include fallback note, got: ${json.note}`);
        assert(json.items[0].decision_label === "missed_deadline", "even fallback expired items must show missed_deadline");
        assert(json.items[0].original_decision_label === "prepare_next", "fallback item should preserve original prepare_next");
      },
    },

    // ── 6. deadlineFilter=expired returns only expired, all as missed_deadline ─
    {
      name: "V2.11I: deadlineFilter=expired returns only expired matches",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { projectId: "proj-1", deadlineFilter: "expired" });
        const json = result.body.content[0].json.data;
        assert(json.items.length >= 1, "should return at least one expired match");
        const forbidden = ["apply_now", "prepare_next", "prepare_first", "needs_review"];
        for (const item of json.items) {
          assert(item.deadline_status === "expired", `all items must be expired, found ${item.deadline_status}`);
          assert(item.decision_label === "missed_deadline", `expired items must be missed_deadline, got ${item.decision_label}`);
          assert(!forbidden.includes(item.decision_label), `forbidden label ${item.decision_label}`);
        }
      },
    },

    // ── 7. deadlineFilter=all marks expired as missed_deadline ─────────────────
    {
      name: "V2.11I: deadlineFilter=all marks expired grants as missed_deadline",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { projectId: "proj-1", deadlineFilter: "all" });
        const json = result.body.content[0].json.data;
        assert(json.items.length === 3, `expected 3 items, got ${json.items.length}`);
        const expiredItem = json.items.find((i: any) => i.grant_id === "grant-expired");
        assert(expiredItem !== undefined, "expired grant must be in all results");
        assert(expiredItem.decision_label === "missed_deadline",
          `expired in 'all' must be missed_deadline, got ${expiredItem.decision_label}`);
        assert(expiredItem.original_decision_label === "apply_now", "original_decision_label must be preserved");
      },
    },

    // ── 8. Sorting: active/upcoming rank above expired despite lower score ──────
    {
      name: "V2.11I: list_grant_matches sorts upcoming before expired despite score",
      fn: async () => {
        const result = await callMcp("list_grant_matches", { projectId: "proj-1", deadlineFilter: "all" });
        const json = result.body.content[0].json.data;
        assert(json.items.length === 3, "should return all matches");
        assert(json.items[0].grant_id === "grant-upcoming", `upcoming (score 85) should rank first, got ${json.items[0].grant_id}`);
        assert(json.items[2].grant_id === "grant-expired", `expired (score 95) should rank last, got ${json.items[2].grant_id}`);
      },
    },

    // ── 9. Upcoming grant still returns apply_now from decision brief ──────────
    {
      name: "V2.11I: upcoming grant can still return apply_now",
      fn: async () => {
        const result = await callMcp("get_grant_decision_brief", { grantId: "grant-upcoming", projectId: "proj-1" });
        const json = result.body.content[0].json.data;
        assert(json.urgency.deadline_status === "upcoming", "should be upcoming");
        assert(json.recommendation === "apply_now", `should retain apply_now, got ${json.recommendation}`);
      },
    },

    // ── 10. MCP schema exposes deadlineFilter on list_grant_matches ────────────
    {
      name: "V2.11I: MCP schema exposes deadlineFilter on list_grant_matches",
      fn: async () => {
        const result = await mcp.handleTools(authHdr) as any;
        assert(result.status === 200, `expected 200 from handleTools, got ${result.status}`);
        const tools = result.body.tools as Array<{ name?: string; schemaSummary?: string }>;
        const matchTool = tools.find((t) => t.name === "list_grant_matches");
        assert(matchTool !== undefined, "list_grant_matches must be in manifest");
        assert(
          matchTool.schemaSummary?.includes("deadlineFilter"),
          `schemaSummary must include deadlineFilter, got: ${matchTool.schemaSummary}`
        );
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
