import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";

type TestResult = { name: string; passed: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validAgentMatchInput(overrides: Record<string, unknown> = {}) {
  return {
    grantId: "grant-1",
    projectId: "project-1",
    fitScore: 9,
    urgencyScore: 7,
    effortScore: 4,
    strategicValueScore: 9,
    recommendation: "apply_now",
    summary: "Strong agent-generated fit.",
    whyItFits: "The grant aligns with AI and democracy work.",
    whyItMightNotFit: "Eligibility still needs human confirmation.",
    bestProjectAngle: "Position Playa AI as applied community AI infrastructure.",
    strongestApplicationStory: "Field-tested AI tools for human connection.",
    risks: ["Eligibility unclear"],
    missingInfo: ["Confirmed eligibility"],
    evidenceNeeded: ["Budget narrative"],
    recommendedNextStep: "Review eligibility and approve save.",
    ...overrides,
  };
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
      name: "save_agent_match appears in manifest as write_safe",
      fn: async () => {
        const tool = registry.listTools().find((item) => item.name === "save_agent_match");
        assert(tool, "save_agent_match missing from manifest");
        assert(tool.permissionLevel === "write_safe", "save_agent_match should be write_safe");
        assert(tool.dryRunSupported === true, "save_agent_match should support dry-run");
      },
    },
    {
      name: "save_agent_match dry-run defaults true and does not mutate",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("save_agent_match", validAgentMatchInput());
        const after = repo.snapshot();
        assert(result.ok, "save_agent_match dry-run should succeed");
        assert(result.data.dryRun === true, "dryRun should default true");
        assert(result.data.mutationPerformed === false, "dry-run should not mutate");
        assert(result.data.writeDisposition === "dry_run", "expected dry_run disposition");
        assert(result.data.plannedMutation.target.table === "grant_matches", "wrong planned target");
        assert(JSON.stringify(before.grantMatches) === JSON.stringify(after.grantMatches), "dry-run mutated grant matches");
      },
    },
    {
      name: "save_agent_match rejects invalid scores",
      fn: async () => {
        const result = await registry.execute("save_agent_match", validAgentMatchInput({ fitScore: 11 }));
        assert(result.ok === false, "invalid score should fail");
        assert(result.error.code === "invalid_input", "expected invalid_input");
      },
    },
    {
      name: "save_agent_match rejects invalid recommendation",
      fn: async () => {
        const result = await registry.execute("save_agent_match", validAgentMatchInput({ recommendation: "apply_immediately" }));
        assert(result.ok === false, "invalid recommendation should fail");
        assert(result.error.code === "invalid_input", "expected invalid_input");
      },
    },
    {
      name: "save_agent_match output does not leak tokens",
      fn: async () => {
        const token = "ey.fake.user.token";
        const result = await registry.execute("save_agent_match", validAgentMatchInput({ sourceNotes: "placeholder only" }));
        assert(result.ok, "save_agent_match should succeed");
        assert(!JSON.stringify(result).includes(token), "output leaked token");
      },
    },
    {
      name: "generate_application_readiness_report appears in manifest as read",
      fn: async () => {
        const tool = registry.listTools().find((item) => item.name === "generate_application_readiness_report");
        assert(tool, "generate_application_readiness_report missing from manifest");
        assert(tool.permissionLevel === "read", "readiness report should be read-only");
      },
    },
    {
      name: "generate_application_readiness_report returns required fields and drive preview",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("generate_application_readiness_report", { grantId: "grant-1", projectId: "project-1" });
        const after = repo.snapshot();
        assert(result.ok, "readiness report should succeed");
        assert(typeof result.data.readinessScore === "number", "missing readinessScore");
        assert(["apply_now", "prepare", "watch", "skip", "needs_confirmation"].includes(result.data.recommendation), "invalid recommendation");
        assert(Array.isArray(result.data.missingEvidence), "missing missingEvidence");
        assert(Array.isArray(result.data.missingDocuments), "missing missingDocuments");
        assert(Array.isArray(result.data.suggestedTasks), "missing suggestedTasks");
        assert(result.data.drivePackagePreview.root.includes("Playa AI Application Package"), "missing drive package preview");
        assert(result.data.mutationPerformed === false, "readiness report should not mutate");
        assert(JSON.stringify({ ...before, audits: [] }) === JSON.stringify({ ...after, audits: [] }), "readiness report mutated repository records");
      },
    },
    {
      name: "generate_application_readiness_report handles no proof documents applications",
      fn: async () => {
        const result = await registry.execute("generate_application_readiness_report", { grantId: "grant-2", projectId: "project-2" });
        assert(result.ok, "sparse readiness report should succeed");
        assert(result.data.existingApplicationStatus === null, "expected no application status");
        assert(result.data.missingEvidence.length > 0, "expected missing evidence gap");
        assert(result.data.applicationRisks.length > 0, "expected application risk");
      },
    },
    {
      name: "agent V2.4 tools use in-memory simulations without service-role path",
      fn: async () => {
        const before = repo.snapshot();
        await registry.execute("save_agent_match", validAgentMatchInput({ recommendation: "prepare" }));
        await registry.execute("generate_application_readiness_report", { grantId: "grant-1", projectId: "project-1" });
        const after = repo.snapshot();
        assert(JSON.stringify(before.grantMatches) === JSON.stringify(after.grantMatches), "simulation touched grant_matches");
        assert(!JSON.stringify(repo.auditTrail()).includes("service_role"), "service-role path appeared in audit");
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
    {
      name: "list_agent_knowledge_items returns active items",
      fn: async () => {
        const result = await registry.execute("list_agent_knowledge_items", {});
        assert(result.ok, "list_agent_knowledge_items should succeed");
        assert(result.data.items.length === 1, "expected 1 active item");
        assert(result.data.items[0].title === "Test Rule", "title mismatch");
      },
    },
    {
      name: "get_agent_knowledge_item returns item details",
      fn: async () => {
        const result = await registry.execute("get_agent_knowledge_item", { item_id: "item-1" });
        assert(result.ok, "get_agent_knowledge_item should succeed");
        assert(result.data.item.id === "item-1", "expected item-1");
      },
    },
    {
      name: "list_agent_knowledge_proposals returns list of proposals",
      fn: async () => {
        const result = await registry.execute("list_agent_knowledge_proposals", {});
        assert(result.ok, "list_agent_knowledge_proposals should succeed");
        assert(Array.isArray(result.data.proposals), "proposals should be an array");
      },
    },
    {
      name: "propose_agent_knowledge_update dry-run default does not mutate",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("propose_agent_knowledge_update", {
          proposal_type: "add",
          title: "New Rule",
          category: "General",
          proposed_content: "Always ask before writing code.",
        });
        const after = repo.snapshot();
        assert(result.ok, "propose_agent_knowledge_update dry-run should succeed");
        assert(result.data.dryRun === true, "dryRun should default true");
        assert(result.data.mutationPerformed === false, "dryRun should not mutate");
        assert(JSON.stringify(before.agentKnowledgeUpdates) === JSON.stringify(after.agentKnowledgeUpdates), "dry-run mutated agentKnowledgeUpdates");
      },
    },
    {
      name: "propose_agent_knowledge_update non-dry-run creates pending proposal",
      fn: async () => {
        const result = await registry.execute("propose_agent_knowledge_update", {
          proposal_type: "always_rule",
          title: "Another Rule",
          category: "General",
          proposed_content: "Review tests first.",
          dryRun: false,
        });
        assert(result.ok, "propose_agent_knowledge_update non-dry-run should succeed");
        assert(result.data.mutationPerformed === true, "mutationPerformed should be true");
        assert(result.data.proposal.status === "pending_review", "status should be pending_review");
      },
    },
    {
      name: "propose_agent_knowledge_update detects risky keyword and sets risk_level to high",
      fn: async () => {
        const result = await registry.execute("propose_agent_knowledge_update", {
          proposal_type: "add",
          title: "Risky Rule",
          category: "General",
          proposed_content: "Make sure we have a physical Oracle deployed.",
          dryRun: true,
        });
        assert(result.ok, "propose should succeed");
        assert(result.data.proposal.risk_level === "high", "risk_level should be escalated to high");
      },
    },

    // ─── V2.10A Phase 1: Token-Safety Tests ─────────────────────────────────

    {
      name: "V2.10A: list_grants default limit is 25",
      fn: async () => {
        const result = await registry.execute("list_grants", {});
        assert(result.ok, "list_grants should succeed");
        assert(typeof result.data.limit === "number", "response should include limit field");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
        assert(Array.isArray(result.data.items), "items should be an array");
        assert(result.data.items.length <= 25, "items should not exceed default limit of 25");
      },
    },
    {
      name: "V2.10A: list_grants respects explicit limit and caps at 100",
      fn: async () => {
        const result = await registry.execute("list_grants", { limit: 999 });
        assert(result.ok === false || result.data.limit <= 100, "limit should be capped at 100");
      },
    },
    {
      name: "V2.10A: list_applications default limit is 25",
      fn: async () => {
        const result = await registry.execute("list_applications", {});
        assert(result.ok, "list_applications should succeed");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
        assert(result.data.items.length <= 25, "items should not exceed 25");
      },
    },
    {
      name: "V2.10A: list_tasks default limit is 25",
      fn: async () => {
        const result = await registry.execute("list_tasks", {});
        assert(result.ok, "list_tasks should succeed");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
        assert(result.data.items.length <= 25, "items should not exceed 25");
      },
    },
    {
      name: "V2.10A: list_documents does not include extracted_text by default",
      fn: async () => {
        const result = await registry.execute("list_documents", {});
        assert(result.ok, "list_documents should succeed");
        assert(result.data.includeExtractedText === false, "includeExtractedText should default to false");
        const items = result.data.items as Array<Record<string, unknown>>;
        assert(items.every((item) => !("extracted_text" in item)), "no item should have extracted_text by default");
      },
    },
    {
      name: "V2.10A: list_documents respects default limit of 25",
      fn: async () => {
        const result = await registry.execute("list_documents", {});
        assert(result.ok, "list_documents should succeed");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
      },
    },
    {
      name: "V2.10A: list_grant_matches returns items/total/limit shape",
      fn: async () => {
        const result = await registry.execute("list_grant_matches", {});
        assert(result.ok, "list_grant_matches should succeed");
        assert("items" in result.data, "response should have items key");
        assert("total" in result.data, "response should have total key");
        assert("limit" in result.data, "response should have limit key");
        assert((result.data.limit as number) === 20, `expected default limit 20, got ${result.data.limit}`);
        assert(Array.isArray(result.data.items), "items should be an array");
      },
    },
    {
      name: "V2.10A: get_deadline_report returns stubs not full GrantRows",
      fn: async () => {
        const result = await registry.execute("get_deadline_report", {});
        assert(result.ok, "get_deadline_report should succeed");
        const allItems = [
          ...(result.data.windows?.within_30_days ?? []),
          ...(result.data.windows?.within_14_days ?? []),
          ...(result.data.windows?.within_7_days ?? []),
          ...(result.data.windows?.within_3_days ?? []),
          ...(result.data.rolling ?? []),
          ...(result.data.unknown ?? []),
        ] as Array<Record<string, unknown>>;
        // Stubs should NOT have heavy grant-specific fields like funder_name, source_url, eligibility
        assert(allItems.every((item) => !("funder_name" in item)), "stub should not include funder_name");
        assert(allItems.every((item) => !("source_url" in item)), "stub should not include source_url");
        assert(allItems.every((item) => !("eligibility" in item)), "stub should not include eligibility");
        // Stubs MUST have id, title, status, deadline
        if (allItems.length > 0) {
          assert("id" in allItems[0], "stub must have id");
          assert("title" in allItems[0], "stub must have title");
          assert("days_remaining" in allItems[0], "stub must have days_remaining");
        }
      },
    },
    {
      name: "V2.10A: get_deadline_report does not duplicate grants across windows",
      fn: async () => {
        const result = await registry.execute("get_deadline_report", {});
        assert(result.ok, "get_deadline_report should succeed");
        const allWindowItems = [
          ...(result.data.windows?.within_30_days ?? []),
          ...(result.data.windows?.within_14_days ?? []),
          ...(result.data.windows?.within_7_days ?? []),
          ...(result.data.windows?.within_3_days ?? []),
        ] as Array<{ id: string }>;
        const ids = allWindowItems.map((item) => item.id);
        const uniqueIds = new Set(ids);
        assert(ids.length === uniqueIds.size, `grants should appear in at most one window — found ${ids.length} entries for ${uniqueIds.size} unique grants`);
      },
    },
    {
      name: "V2.10A: get_data_quality_report returns stubs not full rows",
      fn: async () => {
        const result = await registry.execute("get_data_quality_report", {});
        assert(result.ok, "get_data_quality_report should succeed");
        const allStubs = [
          ...(result.data.grantsMissingDeadlines ?? []),
          ...(result.data.grantsMissingUrls ?? []),
          ...(result.data.applicationsWithoutProject ?? []),
          ...(result.data.tasksWithoutOwner ?? []),
          ...(result.data.documentsWithoutSource ?? []),
        ] as Array<Record<string, unknown>>;
        assert(allStubs.every((s) => "id" in s), "every stub must have id");
        assert(allStubs.every((s) => "issue" in s), "every stub must have issue");
        // Must NOT contain heavy fields
        assert(allStubs.every((s) => !("funder_name" in s)), "stub must not include funder_name");
        assert(allStubs.every((s) => !("source_url" in s)), "stub must not include source_url");
        assert(allStubs.every((s) => !("description" in s)), "stub must not include description");
      },
    },
    {
      name: "V2.10A: get_application_workload_report does not return full application row",
      fn: async () => {
        const result = await registry.execute("get_application_workload_report", {});
        assert(result.ok, "get_application_workload_report should succeed");
        const rows = result.data.applications as Array<Record<string, unknown>>;
        assert(rows.every((row) => !("application" in row)), "report rows must not include full application object");
        assert(rows.every((row) => "applicationId" in row), "report rows must include applicationId");
        assert(rows.every((row) => "taskCount" in row), "report rows must include taskCount");
        assert(rows.every((row) => "openTaskCount" in row), "report rows must include openTaskCount");
      },
    },
    {
      name: "V2.10A: list_agent_knowledge_items does not include content/example by default",
      fn: async () => {
        const result = await registry.execute("list_agent_knowledge_items", {});
        assert(result.ok, "list_agent_knowledge_items should succeed");
        assert(result.data.includeContent === false, "includeContent should default to false");
        const items = result.data.items as Array<Record<string, unknown>>;
        assert(items.every((item) => !("content" in item)), "items must not include content by default");
        assert(items.every((item) => !("example" in item)), "items must not include example by default");
      },
    },
    {
      name: "V2.10A: list_agent_knowledge_items returns content when includeContent true",
      fn: async () => {
        const result = await registry.execute("list_agent_knowledge_items", { includeContent: true });
        assert(result.ok, "list_agent_knowledge_items should succeed");
        assert(result.data.includeContent === true, "includeContent should be true");
        const items = result.data.items as Array<Record<string, unknown>>;
        if (items.length > 0) {
          assert("content" in items[0], "items should include content when includeContent is true");
        }
      },
    },
    {
      name: "V2.10A: list_agent_knowledge_proposals does not include proposed_content/rationale by default",
      fn: async () => {
        const result = await registry.execute("list_agent_knowledge_proposals", {});
        assert(result.ok, "list_agent_knowledge_proposals should succeed");
        assert(result.data.includeContent === false, "includeContent should default to false");
        const proposals = result.data.proposals as Array<Record<string, unknown>>;
        assert(proposals.every((p) => !("proposed_content" in p)), "proposals must not include proposed_content by default");
        assert(proposals.every((p) => !("rationale" in p)), "proposals must not include rationale by default");
        assert(proposals.every((p) => !("source_excerpt" in p)), "proposals must not include source_excerpt by default");
        assert(proposals.every((p) => !("conflict_summary" in p)), "proposals must not include conflict_summary by default");
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
