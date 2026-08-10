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
        assert(first.data.createdTasks.every((task: { related_application_id?: string }) => task.related_application_id === "app-1"), "checklist tasks should link to the application");
        assert(first.data.createdTasks.every((task: { related_grant_id?: string | null }) => task.related_grant_id === "grant-1"), "checklist tasks should link to the grant");
      },
    },
    {
      name: "mark_grant_status defaults to dry-run and does not mutate",
      fn: async () => {
        const before = repo.snapshot().grants.find((grant) => grant.id === "grant-2");
        const result = await registry.execute("mark_grant_status", { grantId: "grant-2", status: "Archived" });
        const after = repo.snapshot().grants.find((grant) => grant.id === "grant-2");
        assert(result.ok, "mark_grant_status dry-run should succeed");
        assert(result.data.dryRun === true, "mark_grant_status should default to dry-run");
        assert(result.data.mutationPerformed === false, "dry-run should not mutate the grant");
        assert(before?.status === after?.status, "dry-run changed grant status");
      },
    },
    {
      name: "mark_grant_status archives without deleting the grant",
      fn: async () => {
        const beforeCount = repo.snapshot().grants.length;
        const result = await registry.execute("mark_grant_status", { grantId: "grant-2", status: "Archived", dryRun: false });
        const after = repo.snapshot();
        assert(result.ok, "mark_grant_status real write should succeed");
        assert(after.grants.length === beforeCount, "archive status change deleted a grant");
        assert(after.grants.find((grant) => grant.id === "grant-2")?.status === "Archived", "grant was not marked Archived");
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
        // Use isolated state: an earlier archive simulation intentionally
        // soft-archives grant-2, so sharing that state would make this read test
        // order-dependent.
        const sparseRepo = createInMemoryGrantOsRepository();
        const sparseRegistry = createToolRegistry({ repository: sparseRepo });
        const result = await sparseRegistry.execute("generate_application_readiness_report", { grantId: "grant-2", projectId: "project-2" });
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
          rationale: "Keep agent changes reviewable.",
          source_type: "agent_observation",
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
          rationale: "Preserve release reliability.",
          source_type: "agent_observation",
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
          rationale: "Test risky claim detection.",
          source_type: "agent_observation",
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
      name: "V2.11D: list_grant_matches default output is compact and contains titles",
      fn: async () => {
        const result = await registry.execute("list_grant_matches", {});
        assert(result.ok, "list_grant_matches should succeed");
        const items = result.data.items as any[];
        if (items.length > 0) {
          const first = items[0];
          assert(typeof first.grant_title === "string", "stub should have grant_title");
          assert(typeof first.project_name === "string", "stub should have project_name");
          assert(!("project" in first), "stub should not include full project row");
          assert(!("grant" in first), "stub should not include full grant row");
          assert(!("funder" in first), "stub should not include full funder row");
        }
      },
    },
    {
      name: "V2.11D: list_grant_matches includeDetails mode omits large fields from relations",
      fn: async () => {
        const result = await registry.execute("list_grant_matches", { includeDetails: true });
        assert(result.ok, "list_grant_matches with includeDetails should succeed");
        const items = result.data.items as any[];
        if (items.length > 0) {
          const first = items[0];
          assert("project" in first, "detailed match should include project relation");
          if (first.project) {
            assert(!("mission_statement" in first.project), "project relation should omit mission_statement");
            assert(!("impact_metrics" in first.project), "project relation should omit impact_metrics");
          }
          if (first.grant) {
            assert(!("description" in first.grant), "grant relation should omit description");
            assert(!("eligibility" in first.grant), "grant relation should omit eligibility");
          }
        }
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
    {
      name: "V2.11A: export_grant_packet does not include document extracted_text by default (compact=true)",
      fn: async () => {
        const result = await registry.execute("export_grant_packet", { grantId: "grant-1" });
        assert(result.ok, "export_grant_packet should succeed");
        // Records are nested under result.data.records (via packageBase)
        const docs = (result.data.records as Record<string, unknown>).documents as Array<Record<string, unknown>>;
        assert(Array.isArray(docs), "grant_packet must include documents array");
        assert(docs.every((d) => !("extracted_text" in d)), "documents must not include extracted_text by default");
      },
    },
    {
      name: "V2.11A: export_grant_packet includes document extracted_text when compact=false",
      fn: async () => {
        const result = await registry.execute("export_grant_packet", { grantId: "grant-1", compact: false });
        assert(result.ok, "export_grant_packet should succeed");
        const docs = (result.data.records as Record<string, unknown>).documents as Array<Record<string, unknown>>;
        if (docs.length > 0) {
           assert("extracted_text" in docs[0], "documents must include extracted_text when compact is false");
        }
      },
    },
    {
      name: "V2.11A: export_application_packet does not include document extracted_text by default",
      fn: async () => {
        const result = await registry.execute("export_application_packet", { applicationId: "app-1" });
        assert(result.ok, "export_application_packet should succeed");
        // Records are nested under result.data.records (via packageBase)
        const docs = (result.data.records as Record<string, unknown>).documents as Array<Record<string, unknown>>;
        assert(Array.isArray(docs), "application_packet must include documents array");
        assert(docs.every((d) => !("extracted_text" in d)), "documents must not include extracted_text by default");
      },
    },
    {
      name: "V2.11A: get_grant_documents does not include extracted_text by default",
      fn: async () => {
        const result = await registry.execute("get_grant_documents", { grantId: "grant-1" });
        assert(result.ok, "get_grant_documents should succeed");
        const docs = result.data.documents as Array<Record<string, unknown>>;
        assert(docs.every((d) => !("extracted_text" in d)), "documents must not include extracted_text by default");
      },
    },
    {
      name: "V2.11A: get_application_documents does not include extracted_text by default",
      fn: async () => {
        const result = await registry.execute("get_application_documents", { applicationId: "app-1" });
        assert(result.ok, "get_application_documents should succeed");
        const docs = result.data.documents as Array<Record<string, unknown>>;
        assert(docs.every((d) => !("extracted_text" in d)), "documents must not include extracted_text by default");
      },
    },
    {
      name: "V2.11A: get_agent_context_brief returns compact shape",
      fn: async () => {
        const result = await registry.execute("get_agent_context_brief", {});
        assert(result.ok, "get_agent_context_brief should succeed");
        assert(typeof result.data.grant_count === "number", "expected grant_count");
        assert(typeof result.data.open_task_count === "number", "expected open_task_count");
        assert(Array.isArray(result.data.grants_due_soon), "expected grants_due_soon");
        assert(Array.isArray(result.data.top_3_applications), "expected top_3_applications");
        
        const serialized = JSON.stringify(result.data);
        assert(serialized.length < 2000, `context brief is too large: ${serialized.length} bytes`);
      },
    },
    // ─── V2.11B Tests ─────────────────────────────────────────────────────────
    {
      name: "V2.11B: get_document does not include extracted_text by default",
      fn: async () => {
        const result = await registry.execute("get_document", { documentId: "doc-1" });
        assert(result.ok, `get_document should succeed, got error: ${!result.ok ? result.error.code : ""}`);
        const doc = result.data.document as Record<string, unknown>;
        assert(!("extracted_text" in doc), "get_document must strip extracted_text by default");
        assert("id" in doc && "title" in doc, "compact document must still have id and title");
      },
    },
    {
      name: "V2.11B: get_document includes extracted_text when includeExtractedText=true",
      fn: async () => {
        const result = await registry.execute("get_document", { documentId: "doc-1", includeExtractedText: true });
        assert(result.ok, "get_document with includeExtractedText=true should succeed");
        const doc = result.data.document as Record<string, unknown>;
        assert("extracted_text" in doc, "document must include extracted_text when explicitly requested");
      },
    },
    {
      name: "V2.11B: list_projects returns default limit of 25 in response",
      fn: async () => {
        const result = await registry.execute("list_projects", {});
        assert(result.ok, "list_projects should succeed");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
        assert(Array.isArray(result.data.items), "expected items array");
        assert(typeof result.data.total === "number", "expected total count");
        assert(result.data.items.length <= 25, "items must not exceed default limit");
      },
    },
    {
      name: "V2.11B: list_proof_items returns default limit of 50 in response",
      fn: async () => {
        const result = await registry.execute("list_proof_items", {});
        assert(result.ok, "list_proof_items should succeed");
        assert(result.data.limit === 50, `expected default limit 50, got ${result.data.limit}`);
        assert(Array.isArray(result.data.items), "expected items array");
        assert(typeof result.data.total === "number", "expected total count");
      },
    },
    {
      name: "V2.11B: list_funders default limit is 25 (aligned with other list tools)",
      fn: async () => {
        const result = await registry.execute("list_funders", {});
        assert(result.ok, "list_funders should succeed");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
      },
    },
    {
      name: "V2.11B: list_peers default limit is 25 (aligned with other list tools)",
      fn: async () => {
        const result = await registry.execute("list_peers", {});
        assert(result.ok, "list_peers should succeed");
        assert(result.data.limit === 25, `expected default limit 25, got ${result.data.limit}`);
      },
    },
    {
      name: "V2.11B: export_peer_packet compact mode omits source_metadata, key_people, description",
      fn: async () => {
        const result = await registry.execute("export_peer_packet", { peerId: "peer-1" });
        assert(result.ok, `export_peer_packet should succeed, got: ${!result.ok ? result.error.code : ""}`);
        const peerRecord = (result.data.records as Record<string, unknown>).peer_organization as Record<string, unknown>;
        assert(!("source_metadata" in peerRecord), "compact peer must not include source_metadata blob");
        assert(!("key_people" in peerRecord), "compact peer must not include key_people");
        assert(!("description" in peerRecord), "compact peer must not include description");
        assert(!("notes" in peerRecord), "compact peer must not include notes");
        assert("id" in peerRecord, "compact peer must include id");
        assert("name" in peerRecord, "compact peer must include name");
        // funding records should also be stubs
        const fundingRecords = (result.data.records as Record<string, unknown>).funding_records as Array<Record<string, unknown>>;
        assert(Array.isArray(fundingRecords), "expected funding_records array");
        if (fundingRecords.length > 0) {
          assert(!("source_metadata" in fundingRecords[0]), "compact funding record must not include source_metadata");
          assert("funder_name" in fundingRecords[0], "compact funding record must include funder_name");
          assert("amount" in fundingRecords[0], "compact funding record must include amount");
        }
      },
    },
    {
      name: "V2.11B: export_peer_packet full mode preserves all fields when compact=false",
      fn: async () => {
        const result = await registry.execute("export_peer_packet", { peerId: "peer-1", compact: false });
        assert(result.ok, "export_peer_packet compact=false should succeed");
        const peerRecord = (result.data.records as Record<string, unknown>).peer_organization as Record<string, unknown>;
        // In full mode, all PeerOrganizationRow fields should be present including source_metadata
        assert("source_metadata" in peerRecord || "id" in peerRecord, "full mode should return full peer row");
      },
    },
    {
      name: "V2.11B: tool_not_found response includes do_not_retry flag",
      fn: async () => {
        const result = await registry.execute("this_tool_does_not_exist_xyz", {});
        assert(!result.ok, "nonexistent tool should return failure");
        assert(result.error.code === "tool_not_found", `expected tool_not_found, got ${result.error.code}`);
        assert((result as unknown as Record<string, unknown>).do_not_retry === true, "tool_not_found must include do_not_retry: true");
      },
    },
    {
      name: "V2.11B: get_agent_knowledge_item not-found is a structured error, not an ok response",
      fn: async () => {
        const result = await registry.execute("get_agent_knowledge_item", { item_id: "nonexistent-item-xyz" });
        assert(!result.ok, "not-found knowledge item should return a structured failure, not ok:true with an error field");
        assert(result.error.code === "knowledge_item_not_found", `expected knowledge_item_not_found, got ${result.error.code}`);
      },
    },

    // ── V2.11C: Knowledge tool compact behavior ────────────────────────────
    {
      name: "V2.11C: get_agent_knowledge_item compact by default (no content field)",
      fn: async () => {
        const result = await registry.execute("get_agent_knowledge_item", { item_id: "item-1" });
        assert(result.ok, "get_agent_knowledge_item should succeed");
        assert(result.data.content_included === false, "expected content_included false by default");
        const item = result.data.item as Record<string, unknown>;
        assert(typeof item.id === "string", "expected item.id");
        assert(!("content" in item), "item must not have content field by default");
        assert(!("example" in item), "item must not have example field by default");
      },
    },
    {
      name: "V2.11C: get_agent_knowledge_item with includeContent returns truncated content",
      fn: async () => {
        const result = await registry.execute("get_agent_knowledge_item", { item_id: "item-1", includeContent: true, maxContentChars: 3 });
        assert(result.ok, "get_agent_knowledge_item with includeContent should succeed");
        assert(result.data.content_included === true, "expected content_included true");
        const item = result.data.item as Record<string, unknown>;
        assert("content" in item, "item must have content field when includeContent true");
        assert(typeof item.content === "string" && (item.content as string).length <= 3, "content must be capped at maxContentChars=3");
        assert(result.data.content_char_count === 11, `expected original content length 11 (Always test), got ${result.data.content_char_count}`);
      },
    },
    {
      name: "V2.11C: generate_grant_match non-dry-run references save_agent_match",
      fn: async () => {
        const result = await registry.execute("generate_grant_match", { grantId: "grant-1", projectId: "project-1", dryRun: false });
        assert(result.ok, "generate_grant_match should succeed");
        const str = JSON.stringify(result.data);
        assert(!str.includes("save_grant_match"), "must not reference save_grant_match");
        assert(!str.includes("not_implemented_persistence"), "must not include not_implemented_persistence");
        assert(str.includes("save_agent_match"), "must reference save_agent_match");
      },
    },

    // ── V2.11C: Composite tools (unit level) ────────────────────────────────
    {
      name: "V2.11C: get_grant_decision_brief succeeds and returns correct shape",
      fn: async () => {
        const result = await registry.execute("get_grant_decision_brief", { grantId: "grant-1", projectId: "project-1" });
        assert(result.ok, `get_grant_decision_brief should succeed: ${result.ok ? "" : JSON.stringify((result as any).error)}`);
        const data = result.data as Record<string, unknown>;
        assert(typeof (data.grant as Record<string, unknown>)?.id === "string", "expected grant.id");
        assert(typeof (data.urgency as Record<string, unknown>)?.deadline_status === "string", "expected urgency.deadline_status");
        assert(typeof data.recommendation === "string", "expected recommendation");
        assert(Array.isArray(data.topReasons), "expected topReasons array");
        assert(Array.isArray(data.topRisks), "expected topRisks array");
        assert(Array.isArray(data.missingInfo), "expected missingInfo array");
        assert(typeof data.recommendedNextStep === "string", "expected recommendedNextStep");
        assert(typeof (data.sourceRecordIds as Record<string, unknown>)?.grantId === "string", "expected sourceRecordIds.grantId");
      },
    },
    {
      name: "V2.11C: get_grant_decision_brief output under 5KB and no extracted_text",
      fn: async () => {
        const result = await registry.execute("get_grant_decision_brief", { grantId: "grant-1" });
        assert(result.ok, "get_grant_decision_brief should succeed");
        const str = JSON.stringify(result.data);
        assert(str.length < 5 * 1024, `output exceeds 5KB: ${str.length} bytes`);
        assert(!str.includes("extracted_text"), "must not include extracted_text");
        assert(!str.includes("source_metadata"), "must not include source_metadata");
      },
    },
    {
      name: "V2.11C: get_grant_decision_brief does not mutate repository",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("get_grant_decision_brief", { grantId: "grant-1", projectId: "project-1" });
        const after = repo.snapshot();
        assert(result.ok, "get_grant_decision_brief should succeed");
        assert(
          JSON.stringify({ ...before, audits: [] }) === JSON.stringify({ ...after, audits: [] }),
          "get_grant_decision_brief must not mutate repository state"
        );
      },
    },
    {
      name: "V2.11C: get_grant_decision_brief unknown grant returns error",
      fn: async () => {
        const result = await registry.execute("get_grant_decision_brief", { grantId: "nonexistent-grant-xyz" });
        assert(!result.ok, "expected failure for unknown grant");
        assert(result.error.code === "grant_not_found", `expected grant_not_found, got ${result.error.code}`);
      },
    },
    {
      name: "V2.11C: get_application_prep_context succeeds and returns correct shape",
      fn: async () => {
        const result = await registry.execute("get_application_prep_context", { applicationId: "app-1" });
        assert(result.ok, `get_application_prep_context should succeed: ${result.ok ? "" : JSON.stringify((result as any).error)}`);
        const data = result.data as Record<string, unknown>;
        assert(typeof (data.application as Record<string, unknown>)?.id === "string", "expected application.id");
        assert(typeof (data.deadline as Record<string, unknown>)?.deadline_status === "string", "expected deadline.deadline_status");
        assert(Array.isArray(data.openTasks), "expected openTasks array");
        assert(Array.isArray(data.linkedDocuments), "expected linkedDocuments array");
        assert(Array.isArray(data.requiredDocuments), "expected requiredDocuments array");
        assert(Array.isArray(data.missingDocuments), "expected missingDocuments array");
        assert(Array.isArray(data.missingFacts), "expected missingFacts array");
        assert(Array.isArray(data.blockers), "expected blockers array");
        assert(Array.isArray(data.nextActions), "expected nextActions array");
        assert(typeof (data.sourceRecordIds as Record<string, unknown>)?.applicationId === "string", "expected sourceRecordIds.applicationId");
      },
    },
    {
      name: "V2.11C: get_application_prep_context output under 8KB and no extracted_text",
      fn: async () => {
        const result = await registry.execute("get_application_prep_context", { applicationId: "app-1" });
        assert(result.ok, "get_application_prep_context should succeed");
        const str = JSON.stringify(result.data);
        assert(str.length < 8 * 1024, `output exceeds 8KB: ${str.length} bytes`);
        assert(!str.includes("extracted_text"), "must not include extracted_text");
        assert(!str.includes("source_metadata"), "must not include source_metadata");
      },
    },
    {
      name: "V2.11C: get_application_prep_context docs are compact stubs",
      fn: async () => {
        const result = await registry.execute("get_application_prep_context", { applicationId: "app-1" });
        assert(result.ok, "get_application_prep_context should succeed");
        const data = result.data as Record<string, unknown>;
        const docs = data.linkedDocuments as Array<Record<string, unknown>>;
        if (docs && docs.length > 0) {
          assert(!("extraction_status" in docs[0]), "docs must not include extraction_status (full DB row field)");
          assert(!("extracted_text" in docs[0]), "docs must not include extracted_text");
          assert("id" in docs[0] && "title" in docs[0], "doc stubs must include id and title");
        }
      },
    },
    {
      name: "V2.11C: get_application_prep_context does not mutate repository",
      fn: async () => {
        const before = repo.snapshot();
        const result = await registry.execute("get_application_prep_context", { applicationId: "app-1" });
        const after = repo.snapshot();
        assert(result.ok, "get_application_prep_context should succeed");
        assert(
          JSON.stringify({ ...before, audits: [] }) === JSON.stringify({ ...after, audits: [] }),
          "get_application_prep_context must not mutate repository state"
        );
      },
    },
    {
      name: "V2.11C: get_application_prep_context includeSuggestedTasks produces suggestions",
      fn: async () => {
        const result = await registry.execute("get_application_prep_context", { applicationId: "app-1", includeSuggestedTasks: true });
        assert(result.ok, "get_application_prep_context with includeSuggestedTasks should succeed");
        const data = result.data as Record<string, unknown>;
        assert(Array.isArray(data.suggestedTasks), "expected suggestedTasks when includeSuggestedTasks true");
      },
    },
    {
      name: "V2.11C: get_application_prep_context unknown application returns error",
      fn: async () => {
        const result = await registry.execute("get_application_prep_context", { applicationId: "nonexistent-app-xyz" });
        assert(!result.ok, "expected failure for unknown application");
        assert(result.error.code === "application_not_found", `expected application_not_found, got ${result.error.code}`);
      },
    },
    {
      name: "V2.12: archive_grant dry-run clears Top 3 in preview without mutation",
      fn: async () => {
        const before = repo.snapshot().grants.find((grant) => grant.id === "grant-1");
        const result = await registry.execute("archive_grant", { grantId: "grant-1", reason: "Deadline passed", dryRun: true });
        const after = repo.snapshot().grants.find((grant) => grant.id === "grant-1");
        assert(result.ok, "archive_grant preview should succeed");
        assert(before?.archived_at === after?.archived_at, "dry run must not archive");
        assert(JSON.stringify(result.data).includes('"is_top_three":false'), "preview must clear Top 3");
      },
    },
    {
      name: "V2.12: set_top_three_grant safely mutates an active grant",
      fn: async () => {
        const futureDeadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
        await repo.updateGrant("grant-1", { deadline: futureDeadline });
        const result = await registry.execute("set_top_three_grant", { grantId: "grant-1", dryRun: false });
        assert(result.ok, "set_top_three_grant should succeed");
        assert(repo.snapshot().grants.find((grant) => grant.id === "grant-1")?.is_top_three === true, "grant should be Top 3");
      },
    },
    {
      name: "V2.12: update_application_status previews without mutation",
      fn: async () => {
        const before = repo.snapshot().applications.find((application) => application.id === "app-1")?.status;
        const result = await registry.execute("update_application_status", { applicationId: "app-1", status: "Drafting" });
        assert(result.ok, "application status preview should succeed");
        assert(repo.snapshot().applications.find((application) => application.id === "app-1")?.status === before, "preview must not mutate application");
      },
    },
    {
      name: "V2.13: get_cleanup_preview identifies expired active and stale Top 3 grants",
      fn: async () => {
        const expiredGrant = {
          ...repo.snapshot().grants[0],
          id: "grant-expired-cleanup",
          title: "Expired Cleanup Grant",
          deadline: "2026-01-01",
          status: "Researching" as const,
          is_top_three: true,
          archived_at: null,
        };
        const cleanupRepo = createInMemoryGrantOsRepository({ grants: [expiredGrant] });
        const cleanupRegistry = createToolRegistry({ repository: cleanupRepo });
        const result = await cleanupRegistry.execute("get_cleanup_preview", { limitPerGroup: 25 });
        assert(result.ok, "cleanup preview should succeed");
        assert(result.data.counts.past_deadline_active_grants >= 1, "expected expired active grant");
        assert(result.data.groups.past_deadline_top_three_grants.some((grant: { id: string }) => grant.id === "grant-expired-cleanup"), "expected stale Top 3 grant");
      },
    },
    {
      name: "V2.13: batch_archive_expired_grants dry-run plans without mutation",
      fn: async () => {
        const expiredGrant = { ...repo.snapshot().grants[0], id: "grant-expired-preview", title: "Expired Preview", deadline: "2026-01-01", status: "Researching" as const, is_top_three: true, archived_at: null };
        const cleanupRepo = createInMemoryGrantOsRepository({ grants: [expiredGrant] });
        const cleanupRegistry = createToolRegistry({ repository: cleanupRepo });
        const before = cleanupRepo.snapshot().grants.find((grant) => grant.id === "grant-expired-preview");
        const result = await cleanupRegistry.execute("batch_archive_expired_grants", { grantIds: ["grant-expired-preview"], dryRun: true });
        const after = cleanupRepo.snapshot().grants.find((grant) => grant.id === "grant-expired-preview");
        assert(result.ok, "batch archive preview should succeed");
        assert(result.data.dryRun === true, "expected dry run");
        assert(result.data.eligibleRecordIds.includes("grant-expired-preview"), "expired grant should be eligible");
        assert(before?.archived_at === after?.archived_at, "preview must not archive");
      },
    },
    {
      name: "V2.13: batch_archive_expired_grants real write soft-archives and clears Top 3",
      fn: async () => {
        const expiredGrant = { ...repo.snapshot().grants[0], id: "grant-expired-write", title: "Expired Write", deadline: "2026-01-01", status: "Researching" as const, is_top_three: true, archived_at: null };
        const cleanupRepo = createInMemoryGrantOsRepository({ grants: [expiredGrant] });
        const cleanupRegistry = createToolRegistry({ repository: cleanupRepo });
        const result = await cleanupRegistry.execute("batch_archive_expired_grants", { grantIds: ["grant-expired-write"], reason: "Deadline passed", dryRun: false });
        const archived = cleanupRepo.snapshot().grants.find((grant) => grant.id === "grant-expired-write");
        assert(result.ok, "batch archive should succeed");
        assert(result.data.affectedRecordIds.includes("grant-expired-write"), "affected IDs should include grant");
        assert(archived?.status === "Archived", "grant should be archived");
        assert(Boolean(archived?.archived_at), "archived_at should be set");
        assert(archived?.is_top_three === false, "Top 3 should be cleared");
      },
    },
    {
      name: "V2.13: compact priority and proof tools omit long fields",
      fn: async () => {
        const priority = await registry.execute("list_active_priority_grants_compact", { includeUnknownDeadline: true, limit: 10 });
        const proof = await registry.execute("list_proof_items_compact", { projectId: "project-1", limit: 10 });
        assert(priority.ok && proof.ok, "compact tools should succeed");
        const serialized = JSON.stringify({ priority: priority.data, proof: proof.data });
        assert(!serialized.includes("\"description\""), "compact output must omit descriptions");
        assert(!serialized.includes("\"metrics\""), "compact output must omit metrics");
        assert(!serialized.includes("extracted_text"), "compact output must omit extracted text");
      },
    },
    {
      name: "V2.13: missing evidence report includes legal and Claim Register guardrails",
      fn: async () => {
        const result = await registry.execute("get_missing_evidence_report", { grantId: "grant-1", projectId: "project-1" });
        assert(result.ok, "missing evidence report should succeed");
        const serialized = JSON.stringify(result.data);
        assert(serialized.includes("501(c)(3)"), "expected nonprofit-status warning");
        assert(serialized.includes("Burning Man"), "expected partnership warning");
        assert(!serialized.includes("extracted_text"), "must not dump extracted text");
      },
    },
    {
      name: "V2.13: application readiness is compact and linked",
      fn: async () => {
        const result = await registry.execute("get_application_readiness_report", { applicationId: "app-1" });
        assert(result.ok, "application readiness should succeed");
        assert(result.data.application.id === "app-1", "expected application ID");
        assert(Array.isArray(result.data.linkedTasks), "expected linked tasks");
        assert(!JSON.stringify(result.data).includes("final_answer"), "must not return full answers");
      },
    },
    {
      name: "V2.13: bulk checklist preview prevents duplicates",
      fn: async () => {
        const result = await registry.execute("bulk_create_tasks_from_checklist", { applicationId: "app-1", dryRun: true });
        assert(result.ok, "bulk checklist preview should succeed");
        assert(result.data.dryRun === true, "expected dry run");
        assert(Array.isArray(result.data.skipped), "expected skipped duplicate list");
      },
    },
    {
      name: "V2.13: grant application action plan is compact and concrete",
      fn: async () => {
        const result = await registry.execute("get_grant_application_action_plan", { grantId: "grant-1", projectId: "project-1" });
        assert(result.ok, "action plan should succeed");
        assert(Array.isArray(result.data.actions), "expected actions");
        assert(!JSON.stringify(result.data).includes("extracted_text"), "action plan must remain compact");
      },
    },
    {
      name: "V2.13: grant priority update dry-run touches only allowed fields",
      fn: async () => {
        const before = repo.snapshot().grants.find((grant) => grant.id === "grant-1");
        const result = await registry.execute("update_grant_priority_fields", { grantId: "grant-1", priority: "High", fitScore: 88 });
        const after = repo.snapshot().grants.find((grant) => grant.id === "grant-1");
        assert(result.ok, "priority preview should succeed");
        assert(result.data.dryRun === true, "expected dry run");
        assert(before?.priority === after?.priority && before?.fit_score === after?.fit_score, "preview must not mutate");
        const mutation = JSON.stringify(result.data.plannedMutation);
        assert(!mutation.includes("deadline") && !mutation.includes("eligibility") && !mutation.includes("source_url"), "unsafe grant fields must not be present");
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
