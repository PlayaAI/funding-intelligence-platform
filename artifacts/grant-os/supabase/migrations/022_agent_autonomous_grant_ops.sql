-- Migration: 022_agent_autonomous_grant_ops
-- Token-bound autonomous internal operations for Grant OS.
-- This migration does not loosen existing grants/applications/tasks RLS and
-- creates no delete, submission, outreach, or arbitrary-mutation RPC.

-- Composite ownership keys make it impossible to attach an autonomy policy,
-- discovery run, or event to a different token owner.
create unique index if not exists idx_agent_mcp_tokens_id_user_id
  on public.agent_mcp_tokens(id, user_id);

create table if not exists public.agent_autonomy_policies (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null unique references public.agent_mcp_tokens(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  enabled boolean not null default false,
  allowed_tools text[] not null default '{}',
  daily_write_limit integer not null default 100 check (daily_write_limit between 1 and 1000),
  max_batch_size integer not null default 50 check (max_batch_size between 1 and 100),
  minimum_fit_score integer not null default 80 check (minimum_fit_score between 0 and 100),
  minimum_deadline_days integer not null default 14 check (minimum_deadline_days between 0 and 365),
  require_primary_source boolean not null default true,
  allow_internal_applications boolean not null default false,
  allow_task_management boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not ('submit_application_externally' = any(allowed_tools))),
  check (not ('send_outreach' = any(allowed_tools))),
  check (not ('delete_record' = any(allowed_tools))),
  check (not ('approve_agent_knowledge_update' = any(allowed_tools)))
);

create table if not exists public.agent_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.agent_mcp_tokens(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  query_summary text,
  sources_checked integer not null default 0 check (sources_checked >= 0),
  candidates_found integer not null default 0 check (candidates_found >= 0),
  grants_created integer not null default 0 check (grants_created >= 0),
  grants_updated integer not null default 0 check (grants_updated >= 0),
  grants_skipped integer not null default 0 check (grants_skipped >= 0),
  warnings jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_autonomy_events (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.agent_autonomy_policies(id) on delete restrict,
  token_id uuid not null references public.agent_mcp_tokens(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  tool_name text not null,
  idempotency_key text not null,
  status text not null default 'claimed' check (status in ('claimed', 'completed', 'failed')),
  mutation_performed boolean not null default false,
  affected_record_ids text[] not null default '{}',
  result_summary jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (token_id, idempotency_key),
  check (tool_name not in ('delete_record', 'submit_application_externally', 'send_outreach', 'approve_agent_knowledge_update'))
);

create unique index if not exists idx_agent_autonomy_policies_identity
  on public.agent_autonomy_policies(id, token_id, user_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'agent_autonomy_policies_token_owner_fk') then
    alter table public.agent_autonomy_policies
      add constraint agent_autonomy_policies_token_owner_fk
      foreign key (token_id, user_id) references public.agent_mcp_tokens(id, user_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agent_discovery_runs_token_owner_fk') then
    alter table public.agent_discovery_runs
      add constraint agent_discovery_runs_token_owner_fk
      foreign key (token_id, user_id) references public.agent_mcp_tokens(id, user_id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agent_autonomy_events_policy_identity_fk') then
    alter table public.agent_autonomy_events
      add constraint agent_autonomy_events_policy_identity_fk
      foreign key (policy_id, token_id, user_id)
      references public.agent_autonomy_policies(id, token_id, user_id) on delete restrict;
  end if;
end $$;

-- Enforce the authorization decision again in the database immediately before
-- the durable execution claim is accepted. The advisory transaction lock makes
-- the per-token daily count safe against concurrent requests.
create or replace function public.enforce_agent_autonomy_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  policy_record public.agent_autonomy_policies%rowtype;
  token_record public.agent_mcp_tokens%rowtype;
  owner_role text;
  writes_today integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.token_id::text, 0));

  select * into policy_record
  from public.agent_autonomy_policies
  where id = new.policy_id
    and token_id = new.token_id
    and user_id = new.user_id
    and enabled = true
    and (expires_at is null or expires_at > pg_catalog.now());
  if not found then
    raise exception using errcode = '42501', message = 'autonomy_policy_invalid';
  end if;

  select * into token_record
  from public.agent_mcp_tokens
  where id = new.token_id
    and user_id = new.user_id
    and revoked_at is null
    and (expires_at is null or expires_at > pg_catalog.now());
  if not found then
    raise exception using errcode = '42501', message = 'agent_token_inactive';
  end if;

  select role into owner_role
  from public.profiles
  where id = new.user_id
    and access_status = 'approved'
    and role in ('Admin', 'Grant Lead');
  if not found then
    raise exception using errcode = '42501', message = 'autonomy_owner_not_authorized';
  end if;

  if not (new.tool_name = any(policy_record.allowed_tools)) or new.tool_name not in (
    'create_grant', 'upsert_grant_from_source', 'bulk_upsert_grants_from_sources',
    'refresh_grant_from_source', 'run_autonomous_grant_ops_cycle', 'run_grant_discovery_cycle',
    'archive_grant', 'batch_archive_expired_grants', 'mark_grant_status', 'update_grant_status',
    'set_top_three_grant', 'remove_top_three_grant', 'update_grant_priority_fields',
    'create_application_from_grant', 'update_application_status', 'add_application_note',
    'generate_application_checklist', 'bulk_create_tasks_from_checklist', 'create_task',
    'update_task_status', 'update_task_due_date', 'propose_agent_knowledge_update'
  ) then
    raise exception using errcode = '42501', message = 'autonomy_tool_not_allowed';
  end if;

  select count(*) into writes_today
  from public.agent_autonomy_events
  where token_id = new.token_id
    and created_at >= pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'UTC') at time zone 'UTC'
    and status in ('claimed', 'completed');
  if writes_today >= policy_record.daily_write_limit then
    raise exception using errcode = '54000', message = 'autonomy_daily_limit_reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_agent_autonomy_claim() from public, anon, authenticated;

drop trigger if exists enforce_agent_autonomy_claim_trigger on public.agent_autonomy_events;
create trigger enforce_agent_autonomy_claim_trigger
  before insert on public.agent_autonomy_events
  for each row execute function public.enforce_agent_autonomy_claim();

create index if not exists idx_agent_autonomy_events_daily_usage
  on public.agent_autonomy_events(token_id, created_at desc)
  where mutation_performed = true;
create index if not exists idx_agent_discovery_runs_token
  on public.agent_discovery_runs(token_id, started_at desc);

alter table public.grants
  add column if not exists source_type text,
  add column if not exists verification_status text,
  add column if not exists deadline_verification_status text,
  add column if not exists applicant_path_status text,
  add column if not exists last_verified_at timestamptz,
  add column if not exists discovered_at timestamptz,
  add column if not exists discovered_by_agent_token_id uuid references public.agent_mcp_tokens(id) on delete set null,
  add column if not exists source_fingerprint text,
  add column if not exists discovery_run_id uuid references public.agent_discovery_runs(id) on delete set null,
  add column if not exists risk_flags text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grants_source_type_check') then
    alter table public.grants add constraint grants_source_type_check
      check (source_type is null or source_type in ('primary', 'secondary', 'unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'grants_verification_status_check') then
    alter table public.grants add constraint grants_verification_status_check
      check (verification_status is null or verification_status in ('verified', 'needs_confirmation', 'unverified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'grants_deadline_verification_status_check') then
    alter table public.grants add constraint grants_deadline_verification_status_check
      check (deadline_verification_status is null or deadline_verification_status in ('verified', 'needs_confirmation', 'rolling', 'unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'grants_applicant_path_status_check') then
    alter table public.grants add constraint grants_applicant_path_status_check
      check (applicant_path_status is null or applicant_path_status in ('verified', 'needs_confirmation', 'ineligible', 'unknown'));
  end if;
end $$;

create index if not exists idx_grants_source_fingerprint on public.grants(source_fingerprint) where source_fingerprint is not null;
create index if not exists idx_grants_last_verified_at on public.grants(last_verified_at desc);
create index if not exists idx_grants_discovery_run on public.grants(discovery_run_id) where discovery_run_id is not null;

alter table public.agent_autonomy_policies enable row level security;
alter table public.agent_discovery_runs enable row level security;
alter table public.agent_autonomy_events enable row level security;

drop policy if exists "agent_autonomy_policies_select" on public.agent_autonomy_policies;
create policy "agent_autonomy_policies_select"
  on public.agent_autonomy_policies for select to authenticated
  using (
    public.is_approved() and
    (user_id = auth.uid() or public.current_user_role() in ('Admin', 'Grant Lead'))
  );

drop policy if exists "agent_autonomy_policies_update" on public.agent_autonomy_policies;
create policy "agent_autonomy_policies_update"
  on public.agent_autonomy_policies for update to authenticated
  using (public.is_approved() and public.current_user_role() in ('Admin', 'Grant Lead'))
  with check (public.is_approved() and public.current_user_role() in ('Admin', 'Grant Lead'));

drop policy if exists "agent_discovery_runs_select" on public.agent_discovery_runs;
create policy "agent_discovery_runs_select"
  on public.agent_discovery_runs for select to authenticated
  using (
    public.is_approved() and
    (user_id = auth.uid() or public.current_user_role() in ('Admin', 'Grant Lead'))
  );

drop policy if exists "agent_autonomy_events_select" on public.agent_autonomy_events;
create policy "agent_autonomy_events_select"
  on public.agent_autonomy_events for select to authenticated
  using (
    public.is_approved() and
    (user_id = auth.uid() or public.current_user_role() in ('Admin', 'Grant Lead'))
  );

-- No INSERT/DELETE policies are granted. Server-side code may create policy,
-- run, and event records only after validating a hashed opaque token. Existing
-- operational table RLS policies remain unchanged.

grant select on public.agent_autonomy_policies to authenticated;
grant select on public.agent_discovery_runs to authenticated;
grant select on public.agent_autonomy_events to authenticated;
grant update on public.agent_autonomy_policies to authenticated;
