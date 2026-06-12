# Grant OS MCP-Compatible Adapter Testing

This document covers the V2.2B MCP-compatible HTTP adapter layered on top of the existing V2.2A Agent Tool API.

## Purpose

The MCP-compatible adapter provides a small HTTP surface for:

- discovering enabled read-only tools
- calling enabled read-only tools with MCP-style request/response envelopes
- checking authenticated upstream health via the existing agent doctor route

It is **not** a full MCP server. It is a compatibility layer over the existing hosted Grant OS Agent API.

## Routes

- `GET /api/mcp/tools`
- `POST /api/mcp/call`
- `GET /api/mcp/doctor`

All three routes require a bearer token header:

```bash
Authorization: Bearer <Supabase user access token>
```

The adapter rejects:

- missing bearer auth
- malformed bearer auth
- service-role-looking JWTs

The adapter never enables write, approval-required, or destructive tools.

## Enabled MCP read-only tools

- `list_grants`
- `search_grants`
- `get_grant`
- `export_grant_packet`
- `list_funders`
- `get_funder`
- `list_projects`
- `get_project`
- `list_applications`
- `get_application`
- `list_tasks`
- `get_task`
- `get_dashboard_summary`
- `get_deadline_report`
- `get_application_workload_report`
- `get_data_quality_report`

## Blocked tools

Examples of blocked tools:

- `create_task`
- `create_application_from_grant`
- `generate_application_checklist`
- `update_task_status`
- `add_application_note`
- `add_peer_organization`
- `add_peer_funding_record`
- `mark_grant_status`
- `save_grant_to_shortlist`
- `archive_record`
- `delete_record`
- `bulk_update_records`
- `send_outreach`
- `submit_application_externally`
- `run_import_job`
- `run_scraping_job`
- `mutate_public_website_content`
- `change_access_policies`

Blocked-tool response shape:

```json
{
  "ok": false,
  "error": {
    "code": "tool_not_allowed",
    "message": "This tool is not enabled for the MCP-compatible adapter."
  }
}
```

## Preview-domain environment

Use the already working preview deployment:

```bash
export GRANT_OS_API_URL="https://88e0d65f-0f25-4b2e-b46e-297427a97943-00-1da2fnqdwmks3.sisko.replit.dev"
export GRANT_OS_USER_ACCESS_TOKEN="<short-lived-supabase-user-token>"
```

Do **not** store this token in files or commit it.

## Preview-domain test commands

### 1. Discover tools

```bash
curl -sS \
  -H "Authorization: Bearer <token-from-env>" \
  "$GRANT_OS_API_URL/api/mcp/tools"
```

Expected:

- `ok: true`
- only read-only tools listed
- no `create_task`
- each tool includes `name`, `description`, `permissionLevel`, `schemaSummary`, and `exampleInput`

### 2. Doctor

```bash
curl -sS \
  -H "Authorization: Bearer <token-from-env>" \
  "$GRANT_OS_API_URL/api/mcp/doctor"
```

Expected:

- upstream doctor response forwarded safely
- visible grants count should be greater than 0 for a real signed-in user with access
- no token value in response

### 3. Search grants

```bash
curl -sS \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-from-env>" \
  "$GRANT_OS_API_URL/api/mcp/call" \
  -d '{
    "name": "search_grants",
    "arguments": {
      "query": "Humanity AI"
    }
  }'
```

Expected:

- `ok: true`
- `tool: "search_grants"`
- `content[0].type === "json"`
- `content[0].json.data.items` contains `Humanity AI Open Call`
- audit payload present
- no token value in response

### 4. Blocked write tool

```bash
curl -sS \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token-from-env>" \
  "$GRANT_OS_API_URL/api/mcp/call" \
  -d '{
    "name": "create_task",
    "arguments": {
      "title": "Should Not Create"
    }
  }'
```

Expected:

- `ok: false`
- `error.code === "tool_not_allowed"`
- no task created

## Local validation

Run the full required suite:

```bash
npx pnpm@10 --filter @workspace/grant-os run typecheck
npx pnpm@10 --filter @workspace/grant-os run build
npx pnpm@10 --filter @workspace/grant-os run test:simulations
npx pnpm@10 --filter @workspace/grant-os run test:agent-tools
npx pnpm@10 --filter @workspace/grant-os run test:agent-auth
npx pnpm@10 --filter @workspace/grant-os run test:agent-api
npx pnpm@10 --filter @workspace/grant-os run test:agent-mcp
```

## Safety notes

- no RLS changes are required
- no service-role keys are used
- no write tools are enabled in the MCP-compatible adapter
- no token values should be logged, stored, or returned
- no live data mutation should occur during the read-only preview checks
