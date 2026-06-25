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

function validAgentMatchArguments(overrides: Record<string, unknown> = {}) {
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
      name: "V2.4 agent planning tools appear in manifest",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        const tools = (result.body.tools ?? []) as Array<{ name?: string; permissionLevel?: string; defaultDryRun?: boolean }>;
        const saveAgentMatch = tools.find((entry) => entry.name === "save_agent_match");
        const readiness = tools.find((entry) => entry.name === "generate_application_readiness_report");
        assert(saveAgentMatch?.permissionLevel === "write_safe", "expected save_agent_match write_safe");
        assert(saveAgentMatch?.defaultDryRun === true, "expected save_agent_match defaultDryRun true");
        assert(readiness?.permissionLevel === "read", "expected readiness report read");
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
      name: "save_agent_match dry-run returns planned grant_matches mutation",
      fn: async () => {
        const before = repository.snapshot().grantMatches.length;
        const result = await adapter.handleCall(authHeaders(), {
          name: "save_agent_match",
          arguments: validAgentMatchArguments(),
        });
        assert(result.status === 200, "expected success status");
        const body = result.body as {
          dryRun?: boolean;
          mutationPerformed?: boolean | null;
          writeDisposition?: string;
          content?: Array<{ json?: { data?: { plannedMutation?: { target?: { table?: string }; payloadSummary?: { source?: string } } } } }>;
        };
        assert(body.dryRun === true, "expected top-level dryRun true");
        assert(body.mutationPerformed === false, "expected top-level mutationPerformed false");
        assert(body.writeDisposition === "dry_run", "expected dry_run disposition");
        assert(body.content?.[0]?.json?.data?.plannedMutation?.target?.table === "grant_matches", "expected grant_matches target");
        assert(body.content?.[0]?.json?.data?.plannedMutation?.payloadSummary?.source === "agent_generated", "expected agent_generated summary");
        assert(repository.snapshot().grantMatches.length === before, "dry-run should not mutate grant matches");
      },
    },
    {
      name: "save_agent_match rejects invalid score through MCP",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "save_agent_match",
          arguments: validAgentMatchArguments({ fitScore: 99 }),
        });
        assert(result.status === 400, "expected invalid input status");
        assert(JSON.stringify(result.body).includes("invalid_input"), "expected invalid_input error");
      },
    },
    {
      name: "generate_application_readiness_report returns gaps and drive preview",
      fn: async () => {
        const before = repository.snapshot();
        const result = await adapter.handleCall(authHeaders(), {
          name: "generate_application_readiness_report",
          arguments: { grantId: "grant-2", projectId: "project-2" },
        });
        const after = repository.snapshot();
        assert(result.status === 200, "expected success status");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        assert(typeof data.readinessScore === "number", "expected readinessScore");
        assert(Array.isArray(data.missingEvidence), "expected missingEvidence array");
        assert(Array.isArray(data.suggestedTasks), "expected suggestedTasks array");
        assert(JSON.stringify(data).includes("Playa AI Application Package"), "expected drive package preview");
        assert(JSON.stringify({ ...before, audits: [] }) === JSON.stringify({ ...after, audits: [] }), "readiness report mutated records");
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

    // ── V2.11C: generate_grant_match persistence fix ──────────────────────────
    {
      name: "V2.11C: generate_grant_match does not reference save_grant_match",
      fn: async () => {
        const dryResult = await adapter.handleCall(authHeaders(), {
          name: "generate_grant_match",
          arguments: { grantId: "grant-1", projectId: "project-1" },
        });
        const liveResult = await adapter.handleCall(authHeaders(), {
          name: "generate_grant_match",
          arguments: { grantId: "grant-1", projectId: "project-1", dryRun: false },
        });
        assert(dryResult.status === 200, "expected dry-run success");
        assert(liveResult.status === 200, "expected live-run success");
        assert(!JSON.stringify(dryResult.body).includes("save_grant_match"), "dry-run must not reference save_grant_match");
        assert(!JSON.stringify(liveResult.body).includes("save_grant_match"), "non-dry-run must not reference save_grant_match");
        assert(!JSON.stringify(liveResult.body).includes("not_implemented_persistence"), "must not include not_implemented_persistence");
        assert(JSON.stringify(liveResult.body).includes("save_agent_match"), "non-dry-run must reference save_agent_match");
      },
    },

    // ── V2.11C: Knowledge tools ───────────────────────────────────────────────
    {
      name: "V2.11C: knowledge list and detail appear in MCP manifest",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        assert(result.status === 200, "expected success");
        const tools = (result.body.tools ?? []) as Array<{ name?: string; permissionLevel?: string }>;
        assert(tools.some((t) => t.name === "list_agent_knowledge_items" && t.permissionLevel === "read"), "expected list_agent_knowledge_items read tool in MCP");
        assert(tools.some((t) => t.name === "get_agent_knowledge_item" && t.permissionLevel === "read"), "expected get_agent_knowledge_item read tool in MCP");
      },
    },
    {
      name: "V2.11C: knowledge proposal/write tools NOT in MCP manifest",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        assert(result.status === 200, "expected success");
        const tools = (result.body.tools ?? []) as Array<{ name?: string }>;
        assert(!tools.some((t) => t.name === "propose_agent_knowledge_update"), "propose_agent_knowledge_update must not be in MCP");
        assert(!tools.some((t) => t.name === "list_agent_knowledge_proposals"), "list_agent_knowledge_proposals must not be in MCP");
      },
    },
    {
      name: "V2.11C: knowledge list omits content by default",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "list_agent_knowledge_items", arguments: {} });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        const items = data.items as Array<JsonRecord> | undefined;
        assert(Array.isArray(items), "expected items array");
        if (items && items.length > 0) {
          assert(!("content" in items[0]), "knowledge list must not include content by default");
          assert(!("example" in items[0]), "knowledge list must not include example by default");
        }
        assert(data.includeContent === false, "expected includeContent false by default");
      },
    },
    {
      name: "V2.11C: get_agent_knowledge_item compact by default",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_agent_knowledge_item", arguments: { item_id: "item-1" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        assert(data.content_included === false, "expected content_included false by default");
        const item = data.item as JsonRecord | undefined;
        assert(item && typeof item.id === "string", "expected item stub with id");
        assert(!item || !("content" in item), "item must not include content by default");
      },
    },
    {
      name: "V2.11C: get_agent_knowledge_item truncates at maxContentChars",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "get_agent_knowledge_item",
          arguments: { item_id: "item-1", includeContent: true, maxContentChars: 5 },
        });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        assert(data.content_included === true, "expected content_included true");
        const item = data.item as JsonRecord | undefined;
        if (item && typeof item.content === "string") {
          assert((item.content as string).length <= 5, "content must be capped at maxContentChars=5");
        }
      },
    },

    // ── V2.11C: Composite tools ───────────────────────────────────────────────
    {
      name: "V2.11C: composite tools appear in MCP manifest",
      fn: async () => {
        const result = await adapter.handleTools(authHeaders());
        assert(result.status === 200, "expected success");
        const tools = (result.body.tools ?? []) as Array<{ name?: string; permissionLevel?: string }>;
        assert(tools.some((t) => t.name === "get_grant_decision_brief" && t.permissionLevel === "read"), "expected get_grant_decision_brief read tool in MCP");
        assert(tools.some((t) => t.name === "get_application_prep_context" && t.permissionLevel === "read"), "expected get_application_prep_context read tool in MCP");
      },
    },
    {
      name: "V2.11C: get_grant_decision_brief output under 5KB",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_grant_decision_brief", arguments: { grantId: "grant-1" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        const size = JSON.stringify(data).length;
        assert(size < 5 * 1024, `get_grant_decision_brief output exceeds 5KB: ${size} bytes`);
      },
    },
    {
      name: "V2.11C: get_grant_decision_brief shape, source IDs, no extracted_text",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_grant_decision_brief", arguments: { grantId: "grant-1", projectId: "project-1" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        const bodyStr = JSON.stringify(data);
        assert(typeof (data.grant as JsonRecord)?.id === "string", "expected grant.id");
        assert(typeof (data.urgency as JsonRecord)?.status === "string", "expected urgency.status");
        assert(typeof data.recommendation === "string", "expected recommendation");
        assert(Array.isArray(data.topReasons), "expected topReasons array");
        assert(Array.isArray(data.topRisks), "expected topRisks array");
        assert(Array.isArray(data.missingInfo), "expected missingInfo array");
        assert(typeof data.recommendedNextStep === "string", "expected recommendedNextStep");
        assert(typeof (data.sourceRecordIds as JsonRecord)?.grantId === "string", "expected sourceRecordIds.grantId");
        assert(Array.isArray((data.sourceRecordIds as JsonRecord)?.projectIds), "expected sourceRecordIds.projectIds");
        assert(!bodyStr.includes("extracted_text"), "must not include extracted_text");
        assert(!bodyStr.includes("source_metadata"), "must not include source_metadata");
      },
    },
    {
      name: "V2.11C: get_grant_decision_brief handles missing funder/match",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_grant_decision_brief", arguments: { grantId: "grant-2" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        assert(typeof data.recommendation === "string", "expected recommendation with missing funder/match");
      },
    },
    {
      name: "V2.11C: get_application_prep_context output under 8KB",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_application_prep_context", arguments: { applicationId: "app-1" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        const size = JSON.stringify(data).length;
        assert(size < 8 * 1024, `get_application_prep_context output exceeds 8KB: ${size} bytes`);
      },
    },
    {
      name: "V2.11C: get_application_prep_context shape, source IDs, no extracted_text",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_application_prep_context", arguments: { applicationId: "app-1" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        const bodyStr = JSON.stringify(data);
        assert(typeof (data.application as JsonRecord)?.id === "string", "expected application.id");
        assert(typeof (data.deadline as JsonRecord)?.status === "string", "expected deadline.status");
        assert(Array.isArray(data.openTasks), "expected openTasks array");
        assert(Array.isArray(data.linkedDocuments), "expected linkedDocuments array");
        assert(Array.isArray(data.missingDocuments), "expected missingDocuments array");
        assert(Array.isArray(data.blockers), "expected blockers array");
        assert(Array.isArray(data.nextActions), "expected nextActions array");
        assert(typeof (data.sourceRecordIds as JsonRecord)?.applicationId === "string", "expected sourceRecordIds.applicationId");
        assert(!bodyStr.includes("extracted_text"), "must not include extracted_text");
        assert(!bodyStr.includes("source_metadata"), "must not include source_metadata");
        const docs = data.linkedDocuments as Array<JsonRecord>;
        if (docs && docs.length > 0) {
          assert(!("extraction_status" in docs[0]), "linkedDocuments must not be full DB rows");
        }
      },
    },
    {
      name: "V2.11C: get_application_prep_context open tasks capped at 10",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), { name: "get_application_prep_context", arguments: { applicationId: "app-1" } });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        const tasks = data.openTasks as Array<JsonRecord>;
        assert(Array.isArray(tasks) && tasks.length <= 10, "openTasks must be capped at 10");
        if (tasks.length > 0) {
          assert(!("description" in tasks[0]), "task stubs must not include description (full row)");
        }
      },
    },
    {
      name: "V2.11C: get_application_prep_context includeSuggestedTasks",
      fn: async () => {
        const result = await adapter.handleCall(authHeaders(), {
          name: "get_application_prep_context",
          arguments: { applicationId: "app-1", includeSuggestedTasks: true },
        });
        assert(result.status === 200, "expected success");
        const data = ((result.body.content ?? []) as Array<{ json?: { data?: JsonRecord } }>)[0]?.json?.data ?? {};
        assert(Array.isArray(data.suggestedTasks), "expected suggestedTasks when includeSuggestedTasks true");
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
