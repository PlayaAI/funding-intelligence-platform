import { readFileSync } from "node:fs";
import { createMcpAdapter } from "../src/lib/agent-mcp/adapter";
import {
  APPROVABLE_TOOL_NAMES,
  buildLegacyMutationApprovalHash,
  buildMutationApprovalHash,
  buildPayloadHashMismatchResponse,
  createInMemoryMutationApprovalStore,
  verifyMutationApprovalPayload,
} from "../src/lib/agent-mcp/approvalService";
import {
  generateAgentToken,
  type AgentTokenRecord,
} from "../src/lib/agent-mcp/agentTokenService";
import { createToolRegistry } from "../src/lib/agent-tools/registry";
import { createInMemoryGrantOsRepository } from "../src/lib/agent-tools/testing";

type TestResult = { name: string; passed: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type StoredToken = AgentTokenRecord & { token_hash: string };

function makeTokenStore() {
  const records = new Map<string, StoredToken>();
  function add(scopes: string[], userId = "user-123", label = "approval test agent") {
    const generated = generateAgentToken();
    const record: StoredToken = {
      id: `token-${records.size + 1}`,
      user_id: userId,
      label,
      token_hash: generated.hash,
      token_prefix: generated.prefix,
      scopes,
      expires_at: null,
      revoked_at: null,
      created_at: "2026-07-24T00:00:00.000Z",
      last_used_at: null,
    };
    records.set(generated.hash, record);
    return { plaintext: generated.plaintext, record };
  }
  return {
    add,
    resolveAgentToken: async (hash: string) => records.get(hash) ?? null,
    updateAgentTokenLastUsed: async () => {},
  };
}

async function run() {
  const tokenStore = makeTokenStore();
  const approvalStore = createInMemoryMutationApprovalStore();
  const seedRepository = createInMemoryGrantOsRepository();
  const expiredGrant = {
    ...seedRepository.snapshot().grants[0],
    id: "grant-expired-approval",
    title: "Expired Approval Grant",
    deadline: "2026-01-01",
    status: "Researching" as const,
    is_top_three: true,
    archived_at: null,
  };
  const repository = createInMemoryGrantOsRepository({ grants: [expiredGrant] });
  const fullScopes = [
    "mcp:read",
    "mcp:write_safe_dry_run",
    "mcp:grants:archive",
    "mcp:applications:create",
    "mcp:applications:update",
    "mcp:tasks:create",
    "mcp:tasks:update",
    "mcp:knowledge:propose",
  ];
  const { plaintext: agentToken, record: agentRecord } = tokenStore.add(fullScopes);
  const { plaintext: readOnlyToken } = tokenStore.add(["mcp:read"], "user-123", "read-only");
  const { plaintext: previewWithoutGranularToken } = tokenStore.add(
    ["mcp:read", "mcp:write_safe_dry_run"],
    "user-123",
    "preview without granular scope"
  );
  const { plaintext: otherToken } = tokenStore.add(fullScopes, "user-456", "other owner");

  const adapter = createMcpAdapter({
    createRepository: () => repository,
    createRegistry: createToolRegistry,
    resolveAgentToken: tokenStore.resolveAgentToken,
    updateAgentTokenLastUsed: tokenStore.updateAgentTokenLastUsed,
    approvalStore,
    serviceRoleKey: null,
  });
  const headers = (token = agentToken) => ({ authorization: `Bearer ${token}` });
  let taskApprovalId = "";

  const cases: Array<{ name: string; fn: () => Promise<void> }> = [
    {
      name: "approval tools are exposed in the MCP manifest",
      fn: async () => {
        const result = await adapter.handleTools(headers());
        const names = ((result.body.tools ?? []) as Array<{ name?: string }>).map((tool) => tool.name);
        for (const expected of ["request_mutation_approval", "get_mutation_approval", "list_pending_mutation_approvals", "execute_approved_mutation"]) {
          assert(names.includes(expected), `missing ${expected}`);
        }
      },
    },
    {
      name: "preview creates a stable approval request without mutation",
      fn: async () => {
        const before = repository.snapshot().tasks.length;
        const result = await adapter.handleCall(headers(), {
          name: "request_mutation_approval",
          arguments: {
            toolName: "create_task",
            arguments: { title: "Approved MCP task", relatedGrantId: "grant-1" },
            expiresInMinutes: 60,
          },
        });
        assert(result.status === 200, JSON.stringify(result.body));
        assert(result.body.writeDisposition === "approval_requested", "expected approval_requested");
        assert(result.body.mutationPerformed === false, "request must not mutate");
        assert(typeof result.body.approvalId === "string", "approval ID missing");
        taskApprovalId = result.body.approvalId as string;
        assert(repository.snapshot().tasks.length === before, "approval request mutated tasks");
        const stored = approvalStore.snapshot()[0];
        assert(stored.payload_hash.length === 64, "stable SHA-256 hash missing");
        assert(stored.status === "pending", "approval should be pending");
      },
    },
    {
      name: "approval response never exposes nonce, token plaintext, or token hash",
      fn: async () => {
        const result = await adapter.handleCall(headers(), {
          name: "get_mutation_approval",
          arguments: { approvalId: taskApprovalId },
        });
        const serialized = JSON.stringify(result.body);
        assert(!serialized.includes(agentToken), "plaintext agent token leaked");
        assert(!serialized.includes("execution_nonce"), "execution nonce leaked");
        assert(!serialized.includes("token_hash"), "token hash leaked");
        assert(!serialized.includes("SUPABASE_SERVICE_ROLE"), "service-role reference leaked");
      },
    },
    {
      name: "read-only token cannot create an approval request",
      fn: async () => {
        const result = await adapter.handleCall(headers(readOnlyToken), {
          name: "request_mutation_approval",
          arguments: { toolName: "create_task", arguments: { title: "Blocked" } },
        });
        assert(result.status === 403, "expected forbidden");
        assert((result.body.error as { code?: string })?.code === "scope_insufficient", "expected scope_insufficient");
      },
    },
    {
      name: "preview token without the target granular scope cannot request approval",
      fn: async () => {
        const result = await adapter.handleCall(headers(previewWithoutGranularToken), {
          name: "request_mutation_approval",
          arguments: { toolName: "create_task", arguments: { title: "Blocked granular request" } },
        });
        assert(result.status === 403, "expected forbidden");
        assert((result.body.error as { code?: string })?.code === "scope_insufficient", "expected scope_insufficient");
        assert(result.body.requiredScope === "mcp:tasks:create", "missing granular required scope");
      },
    },
    {
      name: "another opaque token cannot read the approval",
      fn: async () => {
        const result = await adapter.handleCall(headers(otherToken), {
          name: "get_mutation_approval",
          arguments: { approvalId: taskApprovalId },
        });
        assert(result.status === 404, "cross-owner approval should be hidden");
      },
    },
    {
      name: "unapproved execute call is rejected and does not mutate",
      fn: async () => {
        const before = repository.snapshot().tasks.length;
        const result = await adapter.handleCall(headers(), {
          name: "execute_approved_mutation",
          arguments: { approvalId: taskApprovalId },
        });
        assert(result.status === 403, "expected approval_required");
        assert((result.body.error as { code?: string })?.code === "approval_required", "expected approval_required");
        assert(repository.snapshot().tasks.length === before, "opaque execute mutated data");
      },
    },
    {
      name: "existing write tool can request approval after its dry-run",
      fn: async () => {
        const result = await adapter.handleCall(headers(), {
          name: "create_task",
          arguments: { title: "Inline approval task", relatedGrantId: "grant-1", requestApproval: true },
        });
        assert(result.status === 200, JSON.stringify(result.body));
        assert(result.body.writeDisposition === "approval_requested", "inline approval was not requested");
      },
    },
    {
      name: "batch archive approval contains target IDs and never deletes",
      fn: async () => {
        const result = await adapter.handleCall(headers(), {
          name: "request_mutation_approval",
          arguments: {
            toolName: "batch_archive_expired_grants",
            arguments: { grantIds: ["grant-expired-approval"], reason: "Deadline passed" },
          },
        });
        assert(result.status === 200, JSON.stringify(result.body));
        assert((result.body.affectedRecordIds as string[]).includes("grant-expired-approval"), "expired grant ID missing");
        assert(repository.snapshot().grants.some((grant) => grant.id === "grant-expired-approval"), "grant was deleted");
      },
    },
    {
      name: "application and checklist approval requests remain dry-run only",
      fn: async () => {
        const beforeApps = repository.snapshot().applications.length;
        const app = await adapter.handleCall(headers(), {
          name: "request_mutation_approval",
          arguments: {
            toolName: "create_application_from_grant",
            arguments: { grantId: "grant-1", projectId: "project-2" },
          },
        });
        assert(app.status === 200, JSON.stringify(app.body));
        assert(repository.snapshot().applications.length === beforeApps, "application request mutated data");

        const checklist = await adapter.handleCall(headers(), {
          name: "request_mutation_approval",
          arguments: {
            toolName: "generate_application_checklist",
            arguments: { applicationId: "app-1" },
          },
        });
        assert(checklist.status === 200, JSON.stringify(checklist.body));
      },
    },
    {
      name: "pending batch archive approval passes dashboard revalidation and executes",
      fn: async () => {
        const approval = approvalStore.snapshot().find((record) => record.requested_tool === "batch_archive_expired_grants");
        assert(approval, "archive approval missing");
        const registry = createToolRegistry({ repository, actor: { type: "human", id: "user-123", source: "human" } });
        const preview = await registry.execute(
          approval.requested_tool,
          { ...approval.request_arguments, dryRun: true }
        );
        assert(preview.ok, "dashboard revalidation preview failed");
        const verification = verifyMutationApprovalPayload(approval, preview.data);
        assert(verification.ok, JSON.stringify(verification));
        const execution = await registry.execute(approval.requested_tool, { ...approval.request_arguments, dryRun: false });
        assert(execution.ok, "approved archive execution failed");
        const grant = repository.snapshot().grants.find((candidate) => candidate.id === "grant-expired-approval");
        assert(grant?.status === "Archived", "grant was not archived");
        assert(grant?.is_top_three === false, "Top 3 flag was not cleared");
        assert(repository.snapshot().grants.some((candidate) => candidate.id === "grant-expired-approval"), "grant was hard-deleted");
        assert(execution.audit.status === "completed", "archive audit missing");
      },
    },
    {
      name: "approved application and checklist execution returns linked IDs",
      fn: async () => {
        const registry = createToolRegistry({ repository, actor: { type: "human", id: "user-123", source: "human" } });
        const applicationApproval = approvalStore.snapshot().find((record) => record.requested_tool === "create_application_from_grant");
        assert(applicationApproval, "application approval missing");
        const applicationExecution = await registry.execute(
          applicationApproval.requested_tool,
          { ...applicationApproval.request_arguments, dryRun: false }
        );
        assert(applicationExecution.ok, "application execution failed");
        const applicationData = applicationExecution.data as Record<string, unknown>;
        assert(typeof applicationData.applicationId === "string", "application ID missing");
        const application = repository.snapshot().applications.find((candidate) => candidate.id === applicationData.applicationId);
        assert(application?.grant_id === "grant-1" && application.project_id === "project-2", "application links are wrong");

        const checklistApproval = approvalStore.snapshot().find((record) => record.requested_tool === "generate_application_checklist");
        assert(checklistApproval, "checklist approval missing");
        const checklistExecution = await registry.execute(
          checklistApproval.requested_tool,
          { ...checklistApproval.request_arguments, dryRun: false }
        );
        assert(checklistExecution.ok, "checklist execution failed");
        const checklistData = checklistExecution.data as { affectedRecordIds?: string[] };
        assert((checklistData.affectedRecordIds?.length ?? 0) > 0, "created task IDs missing");
        const linked = repository.snapshot().tasks.filter((task) => checklistData.affectedRecordIds?.includes(task.id));
        assert(linked.every((task) => task.related_application_id === "app-1"), "checklist tasks are not linked to the application");
      },
    },
    {
      name: "batch archive hash ignores runtime timestamp and record ordering only",
      fn: async () => {
        const args = { grantIds: ["grant-a", "grant-b"], reason: "Deadline passed" };
        const requested = buildMutationApprovalHash("batch_archive_expired_grants", args, {
          plannedMutation: {
            table: "grants",
            action: "soft_archive_many",
            records: [
              {
                id: "grant-a",
                before: { status: "Researching", archived_at: null, is_top_three: true },
                after: { status: "Archived", archived_at: "2026-07-24T12:00:00.000Z", is_top_three: false },
              },
              {
                id: "grant-b",
                before: { status: "Planned", archived_at: null, is_top_three: false },
                after: { status: "Archived", archived_at: "2026-07-24T12:00:00.000Z", is_top_three: false },
              },
            ],
          },
          eligibleRecordIds: ["grant-a", "grant-b"],
        });
        const revalidated = buildMutationApprovalHash("batch_archive_expired_grants", args, {
          plannedMutation: {
            table: "grants",
            action: "soft_archive_many",
            records: [
              {
                id: "grant-b",
                before: { status: "Planned", archived_at: null, is_top_three: false },
                after: { status: "Archived", archived_at: "2026-07-24T12:05:00.000Z", is_top_three: false },
              },
              {
                id: "grant-a",
                before: { status: "Researching", archived_at: null, is_top_three: true },
                after: { status: "Archived", archived_at: "2026-07-24T12:05:00.000Z", is_top_three: false },
              },
            ],
          },
          eligibleRecordIds: ["grant-b", "grant-a"],
        });
        assert(requested === revalidated, "runtime timestamps and DB row order must not change the approval hash");
      },
    },
    {
      name: "batch archive default limit selects deterministic IDs from reordered database rows",
      fn: async () => {
        const seed = createInMemoryGrantOsRepository().snapshot().grants[0];
        const tiedDeadlineGrants = Array.from({ length: 55 }, (_, index) => ({
          ...seed,
          id: `grant-tied-${String(index).padStart(2, "0")}`,
          title: `Tied Deadline Grant ${index}`,
          deadline: "2026-01-01",
          status: "Researching" as const,
          archived_at: null,
        }));
        const stableRepository = createInMemoryGrantOsRepository({ grants: tiedDeadlineGrants });
        let reverseRows = false;
        const reorderedRepository = {
          ...stableRepository,
          async listGrants() {
            reverseRows = !reverseRows;
            const rows = await stableRepository.listGrants();
            return reverseRows ? rows : [...rows].reverse();
          },
        };
        const registry = createToolRegistry({
          repository: reorderedRepository,
          actor: { type: "human", id: "user-123", source: "human" },
        });
        const first = await registry.execute("batch_archive_expired_grants", { limit: 50, dryRun: true });
        const second = await registry.execute("batch_archive_expired_grants", { limit: 50, dryRun: true });
        assert(first.ok && second.ok, "batch archive previews failed");
        const firstData = first.data as Record<string, unknown>;
        const secondData = second.data as Record<string, unknown>;
        assert(
          JSON.stringify(firstData.eligibleRecordIds) === JSON.stringify(secondData.eligibleRecordIds),
          "equal-deadline rows changed the limited candidate set"
        );
        assert(
          buildMutationApprovalHash("batch_archive_expired_grants", {}, firstData) ===
            buildMutationApprovalHash("batch_archive_expired_grants", {}, secondData),
          "reordered database rows changed the approval hash"
        );
      },
    },
    {
      name: "pending legacy batch archive approval survives deterministic hash upgrade",
      fn: async () => {
        const args = { grantIds: ["grant-a", "grant-b"], reason: "Deadline passed" };
        const originalPreview = {
          plannedMutation: {
            table: "grants",
            action: "soft_archive_many",
            records: [
              {
                id: "grant-a",
                before: { status: "Researching", archived_at: null, is_top_three: true },
                after: { status: "Archived", archived_at: "2026-07-24T12:00:00.000Z", is_top_three: false },
              },
              {
                id: "grant-b",
                before: { status: "Planned", archived_at: null, is_top_three: false },
                after: { status: "Archived", archived_at: "2026-07-24T12:00:00.000Z", is_top_three: false },
              },
            ],
          },
          eligibleRecordIds: ["grant-a", "grant-b"],
        };
        const legacyApproval = {
          ...approvalStore.snapshot()[0],
          requested_tool: "batch_archive_expired_grants",
          request_arguments: args,
          dry_run_payload: originalPreview,
          payload_hash: buildLegacyMutationApprovalHash(
            "batch_archive_expired_grants",
            args,
            originalPreview
          ),
        };
        const revalidatedPreview = {
          plannedMutation: {
            table: "grants",
            action: "soft_archive_many",
            records: [...originalPreview.plannedMutation.records].reverse().map((record) => ({
              ...record,
              after: { ...record.after, archived_at: "2026-07-24T12:10:00.000Z" },
            })),
          },
          eligibleRecordIds: ["grant-b", "grant-a"],
        };
        const verification = verifyMutationApprovalPayload(legacyApproval, revalidatedPreview);
        assert(verification.ok, JSON.stringify(verification));
        assert(verification.hashVersion === "legacy-v1", "legacy compatibility path was not used");
        assert(
          verification.expectedHashForClaim === legacyApproval.payload_hash,
          "database claim must use the stored legacy hash"
        );
      },
    },
    {
      name: "stale modified payload is rejected with explicit payload_hash_mismatch",
      fn: async () => {
        const args = { taskId: "task-1", status: "Complete" };
        const storedHash = buildMutationApprovalHash("update_task_status", args, {
          plannedMutation: { table: "tasks", id: "task-1", values: { status: "Complete" } },
          previousStatus: "In Progress",
        });
        const approval = {
          ...approvalStore.snapshot()[0],
          requested_tool: "update_task_status",
          request_arguments: args,
          payload_hash: storedHash,
        };
        const verification = verifyMutationApprovalPayload(approval, {
          plannedMutation: { table: "tasks", id: "task-1", values: { status: "Complete" } },
          previousStatus: "Waiting",
        });
        assert(!verification.ok, "before-state drift must fail verification");
        assert(verification.error.code === "payload_hash_mismatch", "expected explicit payload_hash_mismatch");
        const response = buildPayloadHashMismatchResponse("approval-stale");
        assert(response.status === 409, "stale payload must return HTTP 409");
        assert(response.body.error.code === "payload_hash_mismatch", "409 body must explain the mismatch");
        assert(response.body.requiredAction === "request_new_approval", "409 body must explain the recovery action");
      },
    },
    {
      name: "unsupported and destructive tools cannot request approval",
      fn: async () => {
        for (const toolName of ["archive_record", "delete_record", "submit_application_externally", "send_outreach"]) {
          const result = await adapter.handleCall(headers(), {
            name: "request_mutation_approval",
            arguments: { toolName, arguments: {} },
          });
          assert(result.status === 403, `${toolName} should be blocked`);
          assert((result.body.error as { code?: string })?.code === "unsupported_operation", `${toolName} returned wrong code`);
        }
        assert(!APPROVABLE_TOOL_NAMES.has("approve_agent_knowledge_update"), "knowledge approval must not be agent-approvable");
      },
    },
    {
      name: "opaque dryRun false remains rejected without approval execution",
      fn: async () => {
        const result = await adapter.handleCall(headers(), {
          name: "create_task",
          arguments: { title: "Never direct", dryRun: false },
        });
        assert(result.status === 403, "direct opaque write should be rejected");
        assert((result.body.error as { code?: string })?.code === "dry_run_required", "expected dry_run_required");
      },
    },
    {
      name: "executed approval returns committed readback without replaying",
      fn: async () => {
        const before = repository.snapshot().tasks.length;
        const registry = createToolRegistry({ repository, actor: { type: "human", id: "user-123", source: "human" } });
        const execution = await registry.execute("create_task", {
          title: "Approved MCP task",
          relatedGrantId: "grant-1",
          dryRun: false,
        });
        assert(execution.ok, "simulated authenticated execution failed");
        const data = execution.data as Record<string, unknown>;
        const affected = data.affectedRecordIds as string[];
        approvalStore.update(taskApprovalId, {
          status: "executed",
          approved_by_user_id: "user-123",
          approved_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          affected_record_ids: affected,
          result_payload: data,
        });
        const first = await adapter.handleCall(headers(), {
          name: "execute_approved_mutation",
          arguments: { approvalId: taskApprovalId },
        });
        const second = await adapter.handleCall(headers(), {
          name: "execute_approved_mutation",
          arguments: { approvalId: taskApprovalId },
        });
        assert(first.body.writeDisposition === "committed", "expected committed readback");
        assert(second.body.writeDisposition === "committed", "repeat should return idempotent readback");
        assert(repository.snapshot().tasks.length === before + 1, "polling replayed the mutation");
      },
    },
    {
      name: "expired approvals cannot execute",
      fn: async () => {
        const approval = approvalStore.snapshot().find((record) => record.requested_by_token_id === agentRecord.id && record.status === "pending");
        assert(approval, "pending approval missing");
        approvalStore.update(approval.id, { status: "expired", error_code: "approval_expired" });
        const result = await adapter.handleCall(headers(), {
          name: "execute_approved_mutation",
          arguments: { approvalId: approval.id },
        });
        assert(result.status === 409, "expired approval should be rejected");
        assert((result.body.error as { code?: string })?.code === "approval_expired", "expected approval_expired");
      },
    },
    {
      name: "migration contract has RLS, RPC guards, audit, and no client mutation policy",
      fn: async () => {
        const sql = readFileSync(new URL("../supabase/migrations/021_agent_mutation_approvals.sql", import.meta.url), "utf8");
        assert(sql.includes("alter table public.agent_mutation_approvals enable row level security"), "approval RLS missing");
        assert(sql.includes("public.current_user_role() in ('Admin', 'Grant Lead')"), "Admin/Grant Lead review policy missing");
        assert(sql.includes("public.current_user_role() not in ('Admin', 'Grant Lead')"), "Admin/Grant Lead action guard missing");
        assert(sql.includes("claim_agent_mutation_approval"), "claim RPC missing");
        assert(sql.includes("p_execution_nonce"), "nonce guard missing");
        assert(sql.includes("approval_payload_changed"), "payload hash guard missing");
        assert(sql.includes("required_scope = any(token.scopes)"), "granular scope revalidation missing");
        assert(sql.includes("approval_tool_unsupported"), "database tool allowlist guard missing");
        assert(sql.includes("approval_token_inactive_or_scope_changed"), "token lifecycle guard missing");
        assert(sql.includes("agent_mutation_approval_events"), "durable audit table missing");
        assert(!/create policy[^;]+for (insert|update|delete)/is.test(sql), "client mutation policy must not exist");
        assert(!/delete\s+from\s+public\.(grants|applications|tasks|agent_knowledge_items)/i.test(sql), "operational hard delete found");
        assert(!sql.includes("submit_application"), "submission capability found");
        assert(!sql.includes("send_outreach"), "outreach capability found");
      },
    },
    {
      name: "dashboard execution route uses the approving user JWT and revalidates the hash",
      fn: async () => {
        const server = readFileSync(new URL("../src/server/server.ts", import.meta.url), "utf8");
        const start = server.indexOf("async function handleAgentApprovals");
        const end = server.indexOf("// ── V2.11H: Agent token management routes", start);
        const approvalRoute = server.slice(start, end);
        assert(approvalRoute.includes("getAuthenticatedProfile(request, false)"), "approval route does not require user-scoped profile lookup");
        assert(approvalRoute.includes("createLiveGrantOsRepository({ authContext })"), "operational execution does not use user JWT repository");
        assert(approvalRoute.includes("verifyMutationApprovalPayload"), "execution revalidation hash missing");
        assert(approvalRoute.includes("buildPayloadHashMismatchResponse"), "explicit payload mismatch response missing");
        assert(approvalRoute.includes("claim_agent_mutation_approval"), "atomic claim missing");
        assert(approvalRoute.includes("complete_agent_mutation_approval"), "completion audit missing");
        assert(approvalRoute.includes('profile.role === "Admin" || profile.role === "Grant Lead"'), "approver role check missing");
        assert(!approvalRoute.includes("supabaseServiceRoleKey"), "approval execution route references service-role key");
      },
    },
  ];

  const results: TestResult[] = [];
  console.log("Grant OS MCP Approved Write Simulations");
  console.log("Mode: in-memory approval store and repository / no real Supabase writes\n");
  for (const testCase of cases) {
    try {
      await testCase.fn();
      results.push({ name: testCase.name, passed: true });
      console.log(`✅ ${testCase.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name: testCase.name, passed: false, error: message });
      console.error(`❌ ${testCase.name} — ${message}`);
    }
  }
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  console.log(`\nSummary:\n${passed} passed, ${failed} failed, 0 skipped`);
  console.log("Real database touched: NO");
  if (failed) process.exitCode = 1;
}

await run();
