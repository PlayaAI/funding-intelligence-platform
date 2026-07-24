-- Migration: 021_agent_mutation_approvals
-- Delegated, human-approved MCP operational writes.
--
-- Opaque MCP tokens may create approval envelopes through the Grant OS server,
-- but they never execute operational mutations. An authenticated Admin or
-- Grant Lead claims an approval, after which the server executes the existing
-- allowlisted tool with that user's Supabase JWT. Existing table RLS applies.

create table if not exists public.agent_mutation_approvals (
  id uuid primary key default gen_random_uuid(),
  -- Preserve the approval and audit chain. Operators revoke tokens rather than
  -- deleting them; referenced users/tokens cannot be deleted until reconciled.
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  requested_by_token_id uuid not null references public.agent_mcp_tokens(id) on delete restrict,
  requested_by_agent_label text not null default '',
  requested_tool text not null,
  requested_action text not null,
  status text not null default 'pending'
    check (status in ('pending', 'executing', 'executed', 'rejected', 'expired', 'failed')),
  request_arguments jsonb not null default '{}'::jsonb,
  dry_run_payload jsonb not null default '{}'::jsonb,
  planned_mutation jsonb not null default '{}'::jsonb,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  approved_payload_hash text,
  execution_nonce uuid not null default gen_random_uuid(),
  affected_record_ids text[] not null default '{}',
  risk_warnings text[] not null default '{}',
  expires_at timestamptz not null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  execution_started_at timestamptz,
  executed_at timestamptz,
  rejected_at timestamptz,
  rejected_by_user_id uuid references auth.users(id) on delete set null,
  rejection_reason text,
  result_payload jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_mutation_approvals_status
  on public.agent_mutation_approvals(status, created_at desc);
create index if not exists idx_agent_mutation_approvals_token
  on public.agent_mutation_approvals(requested_by_token_id, created_at desc);
create index if not exists idx_agent_mutation_approvals_owner
  on public.agent_mutation_approvals(requested_by_user_id, created_at desc);
create index if not exists idx_agent_mutation_approvals_expiry
  on public.agent_mutation_approvals(expires_at)
  where status = 'pending';

drop trigger if exists agent_mutation_approvals_set_updated_at
  on public.agent_mutation_approvals;
create trigger agent_mutation_approvals_set_updated_at
  before update on public.agent_mutation_approvals
  for each row execute procedure public.set_updated_at();

create table if not exists public.agent_mutation_approval_events (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.agent_mutation_approvals(id) on delete restrict,
  event_type text not null
    check (event_type in (
      'requested', 'approved', 'execution_started', 'executed',
      'rejected', 'expired', 'failed'
    )),
  actor_type text not null
    check (actor_type in ('mcp_token', 'dashboard_user', 'server')),
  token_id uuid references public.agent_mcp_tokens(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  mutation_performed boolean not null default false,
  write_disposition text not null
    check (write_disposition in (
      'approval_requested', 'approved', 'executing', 'committed',
      'rejected', 'expired', 'failed'
    )),
  affected_record_ids text[] not null default '{}',
  before_summary jsonb,
  after_summary jsonb,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_mutation_approval_events_approval
  on public.agent_mutation_approval_events(approval_id, created_at);

alter table public.agent_mutation_approvals enable row level security;
alter table public.agent_mutation_approval_events enable row level security;

-- Approved users can read approval envelopes they own. Admins and Grant Leads
-- can inspect the complete single-workspace queue. There are intentionally no
-- direct client insert, update, or delete policies.
drop policy if exists "agent_mutation_approvals_select" on public.agent_mutation_approvals;
create policy "agent_mutation_approvals_select"
  on public.agent_mutation_approvals
  for select
  using (
    public.is_approved()
    and (
      requested_by_user_id = auth.uid()
      or public.current_user_role() in ('Admin', 'Grant Lead')
    )
  );

drop policy if exists "agent_mutation_approval_events_select" on public.agent_mutation_approval_events;
create policy "agent_mutation_approval_events_select"
  on public.agent_mutation_approval_events
  for select
  using (
    public.is_approved()
    and exists (
      select 1
      from public.agent_mutation_approvals approval
      where approval.id = approval_id
        and (
          approval.requested_by_user_id = auth.uid()
          or public.current_user_role() in ('Admin', 'Grant Lead')
        )
    )
  );

-- Atomically validate and claim one pending approval. The operational tool is
-- executed afterwards with the same user's JWT, so existing RLS still applies.
create or replace function public.claim_agent_mutation_approval(
  p_approval_id uuid,
  p_expected_payload_hash text,
  p_execution_nonce uuid
)
returns public.agent_mutation_approvals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approval public.agent_mutation_approvals%rowtype;
  required_scope text;
begin
  if auth.uid() is null or not public.is_approved() or not public.can_write() then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;

  select *
    into approval
    from public.agent_mutation_approvals
   where id = p_approval_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'approval_not_found';
  end if;
  if approval.requested_by_user_id <> auth.uid()
     and public.current_user_role() not in ('Admin', 'Grant Lead') then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;
  if approval.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'approval_not_pending';
  end if;
  if approval.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'approval_expired';
  end if;
  if approval.payload_hash <> p_expected_payload_hash then
    raise exception using errcode = 'P0001', message = 'approval_payload_changed';
  end if;
  if approval.execution_nonce <> p_execution_nonce then
    raise exception using errcode = 'P0001', message = 'approval_nonce_invalid';
  end if;

  required_scope := case approval.requested_tool
    when 'archive_grant' then 'mcp:grants:archive'
    when 'batch_archive_expired_grants' then 'mcp:grants:archive'
    when 'mark_grant_status' then 'mcp:grants:update_status'
    when 'update_grant_status' then 'mcp:grants:update_status'
    when 'update_grant_notes' then 'mcp:grants:update_status'
    when 'update_grant_priority_fields' then 'mcp:grants:update_status'
    when 'set_top_three_grant' then 'mcp:grants:top_three'
    when 'remove_top_three_grant' then 'mcp:grants:top_three'
    when 'create_application_from_grant' then 'mcp:applications:create'
    when 'update_application_status' then 'mcp:applications:update'
    when 'add_application_note' then 'mcp:applications:update'
    when 'generate_application_checklist' then 'mcp:tasks:create'
    when 'bulk_create_tasks_from_checklist' then 'mcp:tasks:create'
    when 'create_task' then 'mcp:tasks:create'
    when 'update_task_status' then 'mcp:tasks:update'
    when 'update_task_due_date' then 'mcp:tasks:update'
    when 'propose_agent_knowledge_update' then 'mcp:knowledge:propose'
    else null
  end;
  if required_scope is null or approval.requested_action <> approval.requested_tool then
    raise exception using errcode = 'P0001', message = 'approval_tool_unsupported';
  end if;

  if not exists (
    select 1
      from public.agent_mcp_tokens token
     where token.id = approval.requested_by_token_id
       and token.user_id = approval.requested_by_user_id
       and token.revoked_at is null
       and (token.expires_at is null or token.expires_at > now())
       and 'mcp:write_safe_dry_run' = any(token.scopes)
       and required_scope = any(token.scopes)
  ) then
    raise exception using errcode = 'P0001', message = 'approval_token_inactive_or_scope_changed';
  end if;

  update public.agent_mutation_approvals
     set status = 'executing',
         approved_by_user_id = auth.uid(),
         approved_at = now(),
         approved_payload_hash = payload_hash,
         execution_started_at = now(),
         error_code = null,
         error_message = null
   where id = approval.id
   returning * into approval;

  insert into public.agent_mutation_approval_events (
    approval_id, event_type, actor_type, token_id, user_id,
    mutation_performed, write_disposition, affected_record_ids,
    metadata
  ) values (
    approval.id, 'approved', 'dashboard_user',
    approval.requested_by_token_id, auth.uid(),
    false, 'approved', approval.affected_record_ids,
    jsonb_build_object('payload_hash', approval.payload_hash)
  );

  insert into public.agent_mutation_approval_events (
    approval_id, event_type, actor_type, token_id, user_id,
    mutation_performed, write_disposition, affected_record_ids
  ) values (
    approval.id, 'execution_started', 'server',
    approval.requested_by_token_id, auth.uid(),
    false, 'executing', approval.affected_record_ids
  );

  return approval;
end;
$$;

create or replace function public.complete_agent_mutation_approval(
  p_approval_id uuid,
  p_succeeded boolean,
  p_result_payload jsonb,
  p_affected_record_ids text[],
  p_error_code text default null,
  p_error_message text default null
)
returns public.agent_mutation_approvals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approval public.agent_mutation_approvals%rowtype;
  before_value jsonb;
  after_value jsonb;
begin
  if auth.uid() is null or not public.is_approved() or not public.can_write() then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;

  select *
    into approval
    from public.agent_mutation_approvals
   where id = p_approval_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'approval_not_found';
  end if;
  if approval.status <> 'executing' or approval.approved_by_user_id <> auth.uid() then
    raise exception using errcode = 'P0001', message = 'approval_execution_not_owned';
  end if;

  before_value := p_result_payload->'before';
  after_value := p_result_payload->'after';

  update public.agent_mutation_approvals
     set status = case when p_succeeded then 'executed' else 'failed' end,
         executed_at = case when p_succeeded then now() else null end,
         result_payload = coalesce(p_result_payload, '{}'::jsonb),
         affected_record_ids = coalesce(p_affected_record_ids, '{}'::text[]),
         error_code = p_error_code,
         error_message = p_error_message
   where id = approval.id
   returning * into approval;

  insert into public.agent_mutation_approval_events (
    approval_id, event_type, actor_type, token_id, user_id,
    mutation_performed, write_disposition, affected_record_ids,
    before_summary, after_summary, error_code, error_message
  ) values (
    approval.id,
    case when p_succeeded then 'executed' else 'failed' end,
    'dashboard_user',
    approval.requested_by_token_id,
    auth.uid(),
    p_succeeded,
    case when p_succeeded then 'committed' else 'failed' end,
    approval.affected_record_ids,
    before_value,
    after_value,
    p_error_code,
    p_error_message
  );

  return approval;
end;
$$;

create or replace function public.reject_agent_mutation_approval(
  p_approval_id uuid,
  p_reason text default null
)
returns public.agent_mutation_approvals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approval public.agent_mutation_approvals%rowtype;
begin
  if auth.uid() is null or not public.is_approved() or not public.can_write() then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;

  select *
    into approval
    from public.agent_mutation_approvals
   where id = p_approval_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'approval_not_found';
  end if;
  if approval.requested_by_user_id <> auth.uid()
     and public.current_user_role() not in ('Admin', 'Grant Lead') then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;
  if approval.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'approval_not_pending';
  end if;

  update public.agent_mutation_approvals
     set status = 'rejected',
         rejected_at = now(),
         rejected_by_user_id = auth.uid(),
         rejection_reason = nullif(trim(p_reason), '')
   where id = approval.id
   returning * into approval;

  insert into public.agent_mutation_approval_events (
    approval_id, event_type, actor_type, token_id, user_id,
    mutation_performed, write_disposition, affected_record_ids,
    metadata
  ) values (
    approval.id, 'rejected', 'dashboard_user',
    approval.requested_by_token_id, auth.uid(),
    false, 'rejected', approval.affected_record_ids,
    jsonb_build_object('reason', approval.rejection_reason)
  );

  return approval;
end;
$$;

create or replace function public.expire_agent_mutation_approval(
  p_approval_id uuid
)
returns public.agent_mutation_approvals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  approval public.agent_mutation_approvals%rowtype;
begin
  if auth.uid() is null or not public.is_approved() or not public.can_write() then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;

  select *
    into approval
    from public.agent_mutation_approvals
   where id = p_approval_id
   for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'approval_not_found';
  end if;
  if approval.requested_by_user_id <> auth.uid()
     and public.current_user_role() not in ('Admin', 'Grant Lead') then
    raise exception using errcode = 'P0001', message = 'approval_forbidden';
  end if;
  if approval.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'approval_not_pending';
  end if;

  update public.agent_mutation_approvals
     set status = 'expired',
         error_code = 'approval_expired',
         error_message = 'Approval expired by an authenticated operator.'
   where id = approval.id
   returning * into approval;

  insert into public.agent_mutation_approval_events (
    approval_id, event_type, actor_type, token_id, user_id,
    mutation_performed, write_disposition, affected_record_ids
  ) values (
    approval.id, 'expired', 'dashboard_user',
    approval.requested_by_token_id, auth.uid(),
    false, 'expired', approval.affected_record_ids
  );

  return approval;
end;
$$;

revoke all on function public.claim_agent_mutation_approval(uuid, text, uuid) from public, anon;
revoke all on function public.complete_agent_mutation_approval(uuid, boolean, jsonb, text[], text, text) from public, anon;
revoke all on function public.reject_agent_mutation_approval(uuid, text) from public, anon;
revoke all on function public.expire_agent_mutation_approval(uuid) from public, anon;

grant execute on function public.claim_agent_mutation_approval(uuid, text, uuid) to authenticated;
grant execute on function public.complete_agent_mutation_approval(uuid, boolean, jsonb, text[], text, text) to authenticated;
grant execute on function public.reject_agent_mutation_approval(uuid, text) to authenticated;
grant execute on function public.expire_agent_mutation_approval(uuid) to authenticated;

grant select on public.agent_mutation_approvals to authenticated;
grant select on public.agent_mutation_approval_events to authenticated;
