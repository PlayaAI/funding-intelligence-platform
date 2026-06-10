# Grant OS Hosted Agent API Testing

V2.2A exposes a read-only Agent Tool API inside the same Replit-hosted Grant OS app. This is not MCP, not scraping, not grant automation, and not write access.

## Replit Setup

1. Pull the latest `main` into the existing Replit Grant OS project.
2. Start the app normally using the Replit-managed port.
3. Log in to the dashboard and get a short-lived Supabase user access token from the active session.
4. Export it only in your local shell:

```bash
export GRANT_OS_USER_ACCESS_TOKEN="paste-short-lived-user-token-here"
```

Do not commit tokens, paste tokens into chat, or store them in files.

## Doctor Endpoint

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  https://grant-os.replit.app/api/agent/doctor
```

Expected:

- `ok` is `true`
- visible grants count is greater than `0`
- `humanityAiVisible` is `true`
- Supabase project ref is masked
- no token or key values are returned

## Tool Endpoint

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"search_grants","input":{"query":"Humanity AI"}}' \
  https://grant-os.replit.app/api/agent/tool
```

Expected:

- `ok` is `true`
- `tool` is `search_grants`
- `permissionLevel` is `read`
- the result includes `Humanity AI Open Call`

## Blocked Write Test

```bash
curl -sS \
  -H "Authorization: Bearer $GRANT_OS_USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"create_task","input":{"title":"Should Not Create"}}' \
  https://grant-os.replit.app/api/agent/tool
```

Expected:

- `ok` is `false`
- error code is `tool_not_allowed`
- no task is created
- no live data is mutated

## Cleanup

```bash
unset GRANT_OS_USER_ACCESS_TOKEN
```

Use short-lived user access tokens only. Never use a Supabase service-role key for this API.
