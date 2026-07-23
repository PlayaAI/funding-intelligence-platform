# Grant OS MCP Expansion Implementation Plan

Status: implemented and validated  
Branch: `agent/expand-mcp-tools`  
Scope: `artifacts/grant-os` only

## 1. Current-state audit

### Existing MCP architecture

- HTTP adapter: `src/lib/agent-mcp/adapter.ts`
  - `GET /api/mcp/tools`
  - `POST /api/mcp/call`
  - `GET /api/mcp/doctor`
- Manifest and allow/block lists: `src/lib/agent-mcp/toolManifest.ts`
- Token generation, hashing, validation, and scope checks:
  `src/lib/agent-mcp/agentTokenService.ts`
- Tool registry and audit wrapping: `src/lib/agent-tools/registry.ts`
- Tool implementations: `src/lib/agent-tools/*Tools.ts`
- Repository abstraction and Supabase/in-memory implementations:
  `src/lib/agent-tools/repository.ts` and `testing.ts`
- Token management endpoints: `src/server/server.ts`
- Operator token UI:
  `src/pages/dashboard/DashboardAgentSettingsPage.tsx`

### Existing token and scope model

- Opaque tokens are SHA-256 hashed at rest and plaintext is returned once.
- Expiration, revocation, metadata listing, and last-used updates exist.
- Base scopes are `mcp:read`, `mcp:write_safe_dry_run`, and the recognised
  but creation-blocked `mcp:write_safe_real`.
- Granular scopes exist for grant archive/status/Top 3, applications, tasks,
  proof, knowledge, and audit.
- `dryRun:false` from a preview-only token is rejected with
  `dry_run_required`; it is not silently converted to a preview.
- Opaque tokens do not contain a Supabase user JWT. Current server code uses a
  server-only lookup path to validate them. Enabling opaque-token real writes
  without delegated user identity would bypass RLS and is out of scope.
- Authenticated Supabase user JWT calls use the user client and remain the only
  supported real-write path for this release.

### Existing tools

- Broad reads exist for grants, funders, documents, projects, proof,
  applications, tasks, peers, reports, matches, and knowledge.
- Low-token reads already include `get_agent_context_brief`,
  `get_grant_decision_brief`, and `get_application_prep_context`.
- Safe writes already include application creation, checklist generation,
  task creation/status/due date, application notes/status, grant status,
  archive, and Top 3 changes.
- Dangerous deletion, submission, outreach, scraping, import, and policy tools
  are blocked.

### Existing tests

- `test:agent-tools`
- `test:agent-api`
- `test:agent-mcp`
- `test:agent-mcp-full`
- `test:agent-mcp-tokens`
- In-memory repositories avoid production database writes.
- The workspace may require `node --import tsx` because the `tsx` CLI IPC
  socket can fail with `EPERM`.

### Gaps against human workflows

- No token self-inspection tool.
- Capability discovery does not show current-token allow/deny decisions or
  required scopes.
- Cleanup, priority, and deadline reports are incomplete or too broad.
- No safe batch archive tool.
- Application/checklist mutations need clearer duplicate and ID readbacks.
- No compact application-centric readiness report.
- Proof schema lacks verification status, owner, and last-verified columns;
  tools must return `null` plus warnings rather than invent values.
- Missing-evidence logic must preserve legal/applicant-path and Claim Register
  guardrails.
- Real writes from opaque tokens remain blocked pending an RLS-safe delegated
  authorization design.

## 2. Architecture

### Registry structure

New operational reads and writes live in
`src/lib/agent-tools/operationsTools.ts` and are registered by `registry.ts`.
Token-aware virtual tools are handled by the MCP adapter because they require
the already-authenticated token record rather than application-table access.

### Permission and scope checks

- Reads require `mcp:read`.
- Mutation previews require `mcp:write_safe_dry_run` plus the relevant
  granular scope when granular write scopes are present.
- Authenticated user-JWT real writes execute through Supabase RLS.
- Opaque-token `dryRun:false` remains rejected:
  - no real scope: `dry_run_required`
  - real scope present: `approval_required` pending delegated authorization
- Dangerous and external-action tools remain blocked.

### Dry-run and real-write path

All write-safe tools default to `dryRun:true`, validate before mutation, and
return a planned mutation. Real writes return affected IDs and before/after
summaries. Batch operations skip unsafe records and never hard-delete.

### Audit logging

Registry calls continue to emit `ToolAuditPayload` and attempt durable writes
to `agent_activity_logs`. Adapter-level token/capability calls expose redacted
audit metadata without secrets. Authentication failures occur before the
registry and cannot use application audit logging without a schema/policy
change.

### Compact response design

New reads return bounded arrays and summaries only. Long descriptions, raw
imports, extracted text, full answers, and full notes are excluded. Limits are
validated and responses expose `truncated` and `warnings`.

### Error contract

The adapter normalizes success and rejection metadata. Required codes include
token invalid/expired/revoked, scope/dry-run/approval errors, validation,
record-not-found, duplicate, deadline, unsafe-claim, and unsupported-operation
errors. Existing internal error names are mapped where necessary.

## 3. Prioritized tool roadmap

### P0 — ship in this release

- `get_agent_token_self`
- `list_mcp_capabilities`
- `get_cleanup_preview`
- `batch_archive_expired_grants`
- `list_active_priority_grants_compact`
- `get_deadline_brief`
- strengthen `create_application_from_grant`
- strengthen `generate_application_checklist`
- `get_application_readiness_report`
- `bulk_create_tasks_from_checklist`
- strengthen `create_task`, `update_task_status`, `update_task_due_date`
- `get_missing_evidence_report`
- `list_proof_items_compact`
- `list_agent_knowledge_items_compact`
- expose and strengthen `propose_agent_knowledge_update`

### P1 — implement when safely supported

- `get_grant_application_action_plan`
- `get_next_best_grant_target`
- `update_grant_priority_fields`
- proof linking tools after schema relationships are confirmed
- archive task/application
- compact audit log read

### P2 — later

- grant comparison and compact packets
- funder/project/claim briefs
- budget skeleton and answer outline
- operator handoff export

## 4. Bite-sized implementation tasks

### Task 1 — token self-inspection and capabilities

- Objective: expose safe token metadata and current-token tool authorization.
- Files: `agentTokenService.ts`, `authContext.ts`, `adapter.ts`,
  `toolManifest.ts`, token simulations.
- Tests: no plaintext/hash, correct scopes, correct allow/deny reasons.
- Validation: `test:agent-mcp-tokens`.
- Commit: `feat(grant-os): add MCP capability inspection`

### Task 2 — compact operational reads

- Objective: cleanup, priorities, deadlines, readiness, proof, evidence, and
  knowledge summaries with bounded output.
- Files: new `operationsTools.ts`, `registry.ts`, `toolManifest.ts`, tests.
- Tests: filtering, counts, limits, omission of long fields, risk warnings.
- Validation: `test:agent-tools` and `test:agent-mcp-full`.
- Commit: `feat(grant-os): add compact MCP operations`

### Task 3 — batch archive and workflow mutations

- Objective: safe, dry-run-first batch archive and linked application/task
  workflows with duplicate prevention and readbacks.
- Files: `operationsTools.ts`, `mutationsTools.ts`, repository/testing as
  needed, tests.
- Tests: preview, authenticated real write, skipped submitted/closed records,
  Top 3 clearing, duplicate app/tasks, before/after IDs.
- Validation: `test:agent-tools`, `test:agent-api`, `test:agent-mcp-tokens`.
- Commit: `feat(grant-os): add safe MCP workflow mutations`

### Task 4 — response normalization and security validation

- Objective: consistent top-level read/write/error fields without secrets.
- Files: `adapter.ts`, MCP simulations.
- Tests: exact response contract, no hard-delete/submission/outreach, no token
  material.
- Validation: all MCP suites plus security scan.
- Commit: `test(grant-os): validate MCP safety contract`

## 5. Test plan

- Unit/in-memory registry:
  - expired cleanup detection
  - compact filtering and limits
  - batch preview/no mutation
  - authenticated real batch archive and task/application writes
  - duplicate handling
  - evidence and Claim Register warnings
- MCP adapter:
  - token self/capabilities
  - read-only denial
  - dry-run preview and explicit real-write rejection
  - authenticated JWT real-write success in memory
  - consistent response metadata
- Security:
  - expired/revoked/invalid token rejection
  - no token/hash/service-role values
  - dangerous tools unavailable
  - no production DB use in simulations

## 6. Release plan

- Branch: `agent/expand-mcp-tools`
- Keep implementation in one scoped conventional commit requested by the
  operator: `feat(grant-os): expand MCP agent tools`
- Run typecheck, build, five agent/MCP simulation suites, `git diff --check`,
  and secret scan.
- Publish the exact committed tree through the connected GitHub app and open a
  draft PR to `main`.
- Deployment verification after merge:
  - pull `main` in Replit
  - republish
  - call `/api/mcp/tools`
  - call token self/capabilities
  - run compact read and dry-run mutation probes
- Rollback: revert the merge commit and republish. No migration or production
  data deletion is part of this release.

## Explicitly blocked follow-up

Opaque-token real writes require one of:

1. short-lived delegated Supabase user JWTs, or
2. user-scoped RPCs that verify token ownership, exact tool, record scope,
   approval, expiry, and replay protection.

That work requires schema/RLS/policy design and is intentionally not included.
