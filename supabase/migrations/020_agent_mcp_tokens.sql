-- Migration: 020_agent_mcp_tokens
-- Implements V2.11H: per-user, scoped, revocable agent MCP access tokens.
-- Tokens are stored hashed (SHA-256). Plaintext is shown once at creation.
-- These tokens are valid ONLY for GET /api/mcp/tools and POST /api/mcp/call.

create table if not exists public.agent_mcp_tokens (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  label        text        not null default '',
  -- SHA-256 hex digest of the plaintext token. Never store plaintext.
  token_hash   text        not null unique,
  -- First 16 characters of the plaintext token, for safe display in lists.
  token_prefix text        not null,
  -- Allowed scopes: mcp:read | mcp:write_safe_dry_run
  -- Default is read-only. mcp:write_safe_execute is NOT a valid scope in V2.11H.
  scopes       text[]      not null default '{"mcp:read"}',
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- Fast lookup by hash during MCP auth validation
create index if not exists agent_mcp_tokens_hash_idx
  on public.agent_mcp_tokens (token_hash);

-- Index for listing a user's own tokens
create index if not exists agent_mcp_tokens_user_idx
  on public.agent_mcp_tokens (user_id, created_at desc);

-- RLS: users can only manage their own tokens via a normal user JWT
alter table public.agent_mcp_tokens enable row level security;

-- Owner can list their own tokens
create policy "agent_mcp_tokens_owner_select"
  on public.agent_mcp_tokens
  for select
  using (auth.uid() = user_id);

-- Owner can create tokens for themselves
create policy "agent_mcp_tokens_owner_insert"
  on public.agent_mcp_tokens
  for insert
  with check (auth.uid() = user_id);

-- Owner can revoke (update revoked_at) their own tokens
-- No delete policy: preserve audit trail via revoked_at
create policy "agent_mcp_tokens_owner_update"
  on public.agent_mcp_tokens
  for update
  using (auth.uid() = user_id);
