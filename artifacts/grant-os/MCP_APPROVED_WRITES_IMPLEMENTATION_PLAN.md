# Grant OS MCP Approved Writes — Implementation Plan

Status: implemented and locally validated
Branch: `agent/mcp-approved-real-writes`
Scope: `artifacts/grant-os`

## 1. Current state

- Opaque `gos_mcp_*` tokens are hashed, scoped, revocable, and preview-only.
- Their owner is recorded in `agent_mcp_tokens.user_id`, but the token does not
  contain a Supabase user JWT and therefore cannot safely perform operational
  writes under RLS.
- Normal dashboard sessions use a Supabase user JWT and the existing
  `profiles.role`, `profiles.access_status`, `can_write()`, and table RLS rules.
- Existing write-safe tools already validate inputs, generate dry-run plans,
  and execute through the repository abstraction.
- Grant OS is currently a single workspace. There is no organization/team
  membership table suitable for enforcing cross-organization boundaries.

## 2. Selected architecture

This release implements the delegated user-session approval model.

1. An opaque token runs an existing write-safe tool as a dry-run.
2. With `requestApproval: true`, or through `request_mutation_approval`, the
   server stores the validated request, normalized plan, payload hash, token
   owner, expiry, warnings, and affected IDs.
3. The token can poll its own approvals but cannot approve or execute them.
4. An approved `Admin` or `Grant Lead` opens the Agent Approvals dashboard.
5. Before execution, the server reruns the dry-run with that user's Supabase
   JWT and compares the new normalized payload hash with the approved plan.
6. A user-authenticated RPC atomically claims the approval, records the
   approving user, verifies the nonce/hash/expiry/state, and prevents replay.
7. The existing tool executes with a user-scoped Supabase client. Existing RLS
   applies to every operational insert/update.
8. A user-authenticated RPC records the executed/failed result and audit event.
9. The opaque token polls the approval result and verifies affected IDs and
   readback data.

The service-role client is limited to validating opaque token hashes and
creating/reading approval-envelope records for that token. It never executes
the approved operational mutation.

## 3. Security boundaries

- No opaque-token `dryRun: false` operational execution.
- No service-role key in browser, MCP output, logs, or tool payloads.
- No raw user JWT returned to an agent.
- No arbitrary table, field, SQL, delete, submission, or outreach operation.
- Only explicitly allowlisted `write_safe` tools may request approval.
- The approving user must be approved and have `Admin` or `Grant Lead` role.
- Approval ownership is bound to the MCP token owner; Admins and Grant Leads
  may review all requests in the current single workspace.
- Payload hash, nonce, expiry, row lock, and terminal states prevent changed
  plans and replay.
- Approval creation requires the target tool's granular token scope. The claim
  RPC rechecks the token's owner, lifecycle, preview scope, and granular scope
  immediately before execution.
- Approval/audit rows use restrictive foreign keys so token or user deletion
  cannot silently erase the audit chain.
- A changed plan is rejected and must be previewed/requested again.
- Claim safety rules and existing tool validation run again at execution time.
- Knowledge tools create proposals only; they never approve active facts.

## 4. Schema and RLS

Migration `021_agent_mutation_approvals.sql` adds:

- `agent_mutation_approvals`
- `agent_mutation_approval_events`
- RLS select policies for the token owner, Admins, and Grant Leads
- no client insert/update/delete policies
- authenticated RPCs to claim, reject, expire, and complete requests

The migration does not change RLS policies on grants, applications, tasks,
proof, or knowledge tables.

## 5. Product and API changes

MCP tools:

- `request_mutation_approval`
- `get_mutation_approval`
- `list_pending_mutation_approvals`
- `execute_approved_mutation` (poll/readback for opaque tokens; execution is
  performed by the authenticated approval endpoint)

Authenticated dashboard API:

- `GET /api/agent/approvals`
- `GET /api/agent/approvals/:id`
- `POST /api/agent/approvals/:id/approve`
- `POST /api/agent/approvals/:id/reject`
- `POST /api/agent/approvals/:id/expire`

Dashboard:

- `/dashboard/agent-approvals`
- `/dashboard/agent-approvals/:id`

## 6. Validation

- Typecheck and production build.
- Existing agent tool/API/MCP/full/token simulations.
- New approval simulations for scope, hashing, ownership, expiry, changed
  plans, replay, execution readback, and secret redaction.
- Static migration contract validation for RLS, RPC grants, no delete policy,
  and no operational service-role execution.
- Secret/prompt-residue scan.

Validated locally on 2026-07-24. The simulations use in-memory repositories
and do not touch production Supabase data.

## 7. Deployment order and rollback

1. Apply migration `021_agent_mutation_approvals.sql`.
2. Deploy the Grant OS server/client build.
3. Create a new dry-run-capable token; no new real-write scope is required.
4. Request a harmless approval and reject it.
5. Request a harmless task approval, approve it, and verify the task/readback.

Rollback:

- Deploy the previous application commit first, disabling new approval routes.
- Revoke pending approval tokens if needed.
- Keep approval and event tables for audit. Do not drop them during operational
  rollback.
