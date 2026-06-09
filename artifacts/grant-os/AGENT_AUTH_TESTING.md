# Grant OS Agent Auth Testing

V2.1 lets the internal agent-tool runtime read protected Grant OS data with a normal Supabase user access token while preserving RLS.

This is not full autonomy, scraping, external submission, outreach, or a production MCP server adapter.

## Current Auth/RLS Reality

1. The dashboard can see grants because it runs in the browser with a Supabase Auth session. Supabase receives the user JWT and `auth.uid()` is available to RLS.
2. The CLI/tool runner without `GRANT_OS_USER_ACCESS_TOKEN` has only the anon key and no user session. Protected `grants` rows remain hidden by RLS.
3. The `grants` RLS policy should remain unchanged: authenticated users can select rows via `auth.uid() is not null`; anonymous callers cannot.
4. The correct V2.1 fix is an authenticated user/delegated agent context that creates a per-request Supabase client with anon key plus a normal user bearer token.

## Security Rules

- Use short-lived Supabase user access tokens only.
- Never use a Supabase service-role key.
- Do not commit tokens.
- Do not store tokens in files.
- Do not paste tokens into logs, tickets, or docs.
- The CLI reads `GRANT_OS_USER_ACCESS_TOKEN` from environment only.
- The tool runner uses the public anon key plus `Authorization: Bearer <user access token>` so Supabase RLS still decides visibility.

## Anonymous Expected Behavior

Run without `GRANT_OS_USER_ACCESS_TOKEN`:

```bash
pnpm --filter @workspace/grant-os run agent:doctor
pnpm --filter @workspace/grant-os run agent:tool -- search_grants '{"query":"Humanity AI"}'
```

Expected:

- Auth mode is `anonymous`.
- Token present is `false`.
- Visible grants may be `0`.
- `Humanity AI` is not visible.
- This is expected when `grants` RLS requires `auth.uid() is not null`.

## Authenticated Expected Behavior

From a real signed-in Supabase browser session, set a temporary user access token:

```bash
export GRANT_OS_USER_ACCESS_TOKEN='<short-lived-supabase-user-access-token>'
```

Then run:

```bash
pnpm --filter @workspace/grant-os run agent:doctor
pnpm --filter @workspace/grant-os run agent:tool -- search_grants '{"query":"Humanity AI"}'
pnpm --filter @workspace/grant-os run agent:tool -- get_grant '{"grantId":"28d81882-64c1-4677-84d5-7c9303ef2a58"}'
```

Expected:

- Auth mode is `authenticated`.
- Token present is `true`.
- `Humanity AI` is visible.
- `get_grant` returns the record.
- No DB writes occur for these read-only commands.
- No full token or key is printed.

After testing:

```bash
unset GRANT_OS_USER_ACCESS_TOKEN
```

## What This Proves

Authenticated agent/tool calls can read the same protected grant rows as a logged-in dashboard user because they use a normal user JWT. Supabase RLS remains unchanged and continues to block anonymous access.

## What This Does Not Prove

- It does not connect a real MCP server.
- It does not implement a production token broker.
- It does not grant autonomous write permissions.
- It does not create applications.
- It does not submit grants externally.
- It does not send email or outreach.
