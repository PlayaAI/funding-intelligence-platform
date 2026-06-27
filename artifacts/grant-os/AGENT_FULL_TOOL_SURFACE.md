# Grant OS V2.11H — Full Agent Tool Surface for MCP

## Agent quick start

1. **Get an agent token** via `POST /api/agent/tokens` using a logged-in user session. The plaintext token is shown **once only**.
2. **Call `/api/agent/guide`** (no auth needed) for a public summary of preferred tools and rules.
3. **Call `GET /api/mcp/tools`** with `Authorization: Bearer gos_mcp_<your_token>` to get the full tool list.
4. **For grant recommendations:** call `get_grant_decision_brief` first. Use `list_grant_matches` for an overview.
5. **For application prep:** call `get_application_prep_context` first.
6. **If you get a 401 from `/api/mcp/tools`:** auth is missing — this does not mean tools are missing.
7. Do not inspect raw database data directly. Use MCP tools.
8. Return top 3 results maximum unless the user asks for more.
9. **If token expires or is revoked:** create a new one. Do NOT store user email/password.

### Calling Tools (HTTP)

To invoke any tool listed below, use the `/api/mcp/call` endpoint:

```http
POST /api/mcp/call
Authorization: Bearer gos_mcp_<your_agent_token>
Content-Type: application/json

{
  "name": "list_grant_matches",
  "arguments": {
    "limit": 3,
    "includeDetails": false
  }
}
```
## API base URL

Preview base URL:

```text
https://88e0d65f-0f25-4b2e-b46e-297427a97943-00-1da2fnqdwmks3.sisko.replit.dev
```

MCP-style routes:

- `GET /api/agent/guide` ← public, no auth, returns preferred tools and rules
- `GET /api/mcp/doctor`
- `GET /api/mcp/tools`
- `POST /api/mcp/call`

Token management routes (require normal user JWT, **not** agent token):

- `POST /api/agent/tokens` ← create agent token (plaintext shown once)
- `GET /api/agent/tokens` ← list your tokens (metadata only, no hashes)
- `DELETE /api/agent/tokens/:id` ← revoke a token

## Auth model

### Preferred: Agent Access Token (V2.11H — for external agents)

```
Authorization: Bearer gos_mcp_<your_token>
```

- Create via `POST /api/agent/tokens` (requires logged-in user session, shows plaintext **once only**).
- Valid **only** on MCP routes: `GET /api/mcp/tools`, `POST /api/mcp/call`.
- Scopes: `mcp:read` (default, read-only) or `mcp:write_safe_dry_run` (write_safe tools, dryRun always forced true).
- Revocable via `DELETE /api/agent/tokens/:id`. Supports optional expiry.
- If expired or revoked → create a new token. Do NOT store user email/password.

#### Token error codes

| Code | Meaning |
|---|---|
| `agent_token_invalid` | Token not recognised — obtain a new token |
| `agent_token_expired` | Token past `expires_at` — create a new token |
| `agent_token_revoked` | Token revoked — create a new token |
| `agent_token_not_allowed` | Agent token used on a non-MCP route — use a user session |
| `scope_insufficient` | Token scope does not permit this tool |

### Alternative: Supabase User JWT

```bash
Authorization: Bearer <supabase-user-access-token>
```

Required for admin, team, knowledge management, and token management routes.

### Security rules

- No service-role tokens exposed to agents
- Agent token dryRun always forced true for write_safe tools
- Blocked/approval-required tools remain blocked regardless of token scope
- Token plaintext shown once only — not stored, not returned in list
- Do not store tokens in files or chat logs

## Tool categories

### Read tools

Examples:

- `list_grants`
- `search_grants`
- `get_grant`
- `get_grant_documents`
- `get_grant_applications`
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
- `list_grant_matches`
- `get_grant_match`
- `get_agent_context_brief`
- `list_agent_knowledge_items`
- `get_agent_knowledge_item`
- `get_grant_decision_brief`
- `get_application_prep_context`

### Write-safe tools

These are exposed through MCP with `defaultDryRun: true`:

- `create_application_from_grant`
- `generate_application_checklist`
- `create_task`
- `update_task_status`
- `add_application_note`
- `add_peer_organization`
- `add_peer_funding_record`
- `mark_grant_status`
- `save_grant_to_shortlist`
- `generate_grant_match`
- `save_grant_match`

### Match-generation tools

#### `generate_grant_match`

Purpose:
- prepare a structured grant/project match preview
- default to dry-run
- return agent-usable reasoning fields

Output shape includes:

- `grantId`
- `projectId`
- `fitScore`
- `priorityScore`
- `matchSummary`
- `strengths`
- `risks`
- `missingInfo`
- `recommendedNextStep`
- `source: "agent_generated"`

Behavior:
- `dryRun: true` returns a preview and planned mutation metadata only
- `dryRun: false` does **not** persist directly; it returns a clear message directing callers to `save_grant_match`

#### `save_grant_match`

Purpose:
- persist agent-provided match reasoning into the existing `grant_matches` table
- default to dry-run
- upsert by `project_id + grant_id`

## Dangerous blocked tools

These are not enabled for direct MCP execution:

- `archive_record`
- `delete_record`
- `bulk_update_records`
- `send_outreach`
- `submit_application_externally`
- `run_import_job`
- `run_scraping_job`
- `mutate_public_website_content`
- `change_access_policies`

Blocked call response:

```json
{
  "ok": false,
  "error": {
    "code": "approval_required_or_not_enabled",
    "message": "This tool is not enabled for direct MCP execution."
  }
}
```

## Dry-run default behavior

For MCP-exposed `write_safe` tools:

- if `dryRun` is omitted, MCP injects `dryRun: true`
- responses clearly indicate `dryRun` and `writeDisposition`
- real writes only happen when `dryRun: false` is explicitly provided

## Examples

### Search grants

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search_grants",
    "arguments": { "query": "Humanity AI" }
  }' \
  "$GRANT_OS_API_URL/api/mcp/call"
```

### Generate match preview

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "generate_grant_match",
    "arguments": {
      "grantId": "grant-1",
      "projectId": "project-1",
      "dryRun": true
    }
  }' \
  "$GRANT_OS_API_URL/api/mcp/call"
```

### Create task dry-run

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_task",
    "arguments": {
      "applicationId": "app-1",
      "title": "Draft narrative outline"
    }
  }' \
  "$GRANT_OS_API_URL/api/mcp/call"
```

### Save shortlist dry-run

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "save_grant_to_shortlist",
    "arguments": {
      "grantId": "grant-1",
      "projectId": "project-1"
    }
  }' \
  "$GRANT_OS_API_URL/api/mcp/call"
```

### Real write only when explicit

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "create_task",
    "arguments": {
      "applicationId": "app-1",
      "title": "Assign budget review",
      "dryRun": false
    }
  }' \
  "$GRANT_OS_API_URL/api/mcp/call"
```

## Warnings

- No service-role keys
- No token files
- Do not paste live tokens into chat
- No browser automation
- No background jobs
- No scraping/import execution
- No external submission or outreach
- Production domain is not required yet
