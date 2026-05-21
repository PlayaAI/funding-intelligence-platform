-- Migration: 009_create_agent_layer
-- Grant OS V0.8 — Agent-ready storage for external OpenClaw/Codex outputs

-- ============================================================
-- AGENT NOTES
-- ============================================================

create table if not exists public.agent_notes (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'human'
    check (source in ('human', 'openclaw', 'codex', 'import', 'external_agent')),
  note_type text not null
    check (note_type in ('summary', 'fit_analysis', 'risk', 'next_steps', 'scraped_data', 'readiness_report', 'recommendation', 'general')),
  title text not null,
  content text not null,
  structured_data jsonb,
  related_project_id uuid references public.projects(id) on delete cascade,
  related_grant_id uuid references public.grants(id) on delete cascade,
  related_funder_id uuid references public.funders(id) on delete cascade,
  related_application_id uuid references public.applications(id) on delete cascade,
  related_task_id uuid references public.tasks(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_notes_project on public.agent_notes(related_project_id) where archived_at is null;
create index if not exists idx_agent_notes_grant on public.agent_notes(related_grant_id) where archived_at is null;
create index if not exists idx_agent_notes_funder on public.agent_notes(related_funder_id) where archived_at is null;
create index if not exists idx_agent_notes_application on public.agent_notes(related_application_id) where archived_at is null;
create index if not exists idx_agent_notes_created_at on public.agent_notes(created_at desc);

drop trigger if exists agent_notes_set_updated_at on public.agent_notes;
create trigger agent_notes_set_updated_at
  before update on public.agent_notes
  for each row execute procedure public.set_updated_at();

alter table public.agent_notes enable row level security;

drop policy if exists "auth_select_agent_notes" on public.agent_notes;
drop policy if exists "auth_insert_agent_notes" on public.agent_notes;
drop policy if exists "auth_update_agent_notes" on public.agent_notes;
drop policy if exists "auth_delete_agent_notes" on public.agent_notes;
drop policy if exists "auth_insert_contributor_agent_notes" on public.agent_notes;
drop policy if exists "auth_update_contributor_own_agent_notes" on public.agent_notes;

create policy "auth_select_agent_notes"
  on public.agent_notes for select
  using (auth.uid() is not null);

create policy "auth_insert_agent_notes"
  on public.agent_notes for insert
  with check (public.can_write());

create policy "auth_update_agent_notes"
  on public.agent_notes for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_agent_notes"
  on public.agent_notes for delete
  using (public.can_write());

create policy "auth_insert_contributor_agent_notes"
  on public.agent_notes for insert
  with check (public.can_contribute() and coalesce(created_by, auth.uid()) = auth.uid());

create policy "auth_update_contributor_own_agent_notes"
  on public.agent_notes for update
  using (public.current_user_role() = 'Contributor' and created_by = auth.uid())
  with check (public.current_user_role() = 'Contributor' and created_by = auth.uid());

-- ============================================================
-- AGENT ACTIVITY LOGS
-- ============================================================

create table if not exists public.agent_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_source text not null
    check (actor_source in ('human', 'openclaw', 'codex', 'import', 'external_agent')),
  action_type text not null
    check (action_type in ('import_completed', 'note_created', 'report_generated', 'status_updated', 'task_created', 'data_reviewed', 'export_created', 'manual_entry')),
  title text not null,
  description text,
  status text not null default 'completed'
    check (status in ('completed', 'pending', 'failed')),
  related_project_id uuid references public.projects(id) on delete set null,
  related_grant_id uuid references public.grants(id) on delete set null,
  related_application_id uuid references public.applications(id) on delete set null,
  metadata jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_activity_logs_created_at on public.agent_activity_logs(created_at desc);
create index if not exists idx_agent_activity_logs_project on public.agent_activity_logs(related_project_id);
create index if not exists idx_agent_activity_logs_grant on public.agent_activity_logs(related_grant_id);
create index if not exists idx_agent_activity_logs_application on public.agent_activity_logs(related_application_id);

alter table public.agent_activity_logs enable row level security;

drop policy if exists "auth_select_agent_activity_logs" on public.agent_activity_logs;
drop policy if exists "auth_insert_agent_activity_logs" on public.agent_activity_logs;
drop policy if exists "auth_update_agent_activity_logs" on public.agent_activity_logs;
drop policy if exists "auth_delete_agent_activity_logs" on public.agent_activity_logs;

create policy "auth_select_agent_activity_logs"
  on public.agent_activity_logs for select
  using (auth.uid() is not null);

create policy "auth_insert_agent_activity_logs"
  on public.agent_activity_logs for insert
  with check (public.can_contribute());

create policy "auth_update_agent_activity_logs"
  on public.agent_activity_logs for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_agent_activity_logs"
  on public.agent_activity_logs for delete
  using (public.can_write());

-- ============================================================
-- AGENT REPORTS
-- ============================================================

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null
    check (report_type in ('weekly_readiness', 'grant_readiness', 'application_review', 'funder_summary', 'import_review', 'general')),
  title text not null,
  content text not null,
  structured_data jsonb,
  related_project_id uuid references public.projects(id) on delete set null,
  related_grant_id uuid references public.grants(id) on delete set null,
  related_application_id uuid references public.applications(id) on delete set null,
  source text not null default 'human'
    check (source in ('human', 'openclaw', 'codex', 'import', 'external_agent')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_reports_project on public.agent_reports(related_project_id) where archived_at is null;
create index if not exists idx_agent_reports_grant on public.agent_reports(related_grant_id) where archived_at is null;
create index if not exists idx_agent_reports_application on public.agent_reports(related_application_id) where archived_at is null;
create index if not exists idx_agent_reports_created_at on public.agent_reports(created_at desc);

drop trigger if exists agent_reports_set_updated_at on public.agent_reports;
create trigger agent_reports_set_updated_at
  before update on public.agent_reports
  for each row execute procedure public.set_updated_at();

alter table public.agent_reports enable row level security;

drop policy if exists "auth_select_agent_reports" on public.agent_reports;
drop policy if exists "auth_insert_agent_reports" on public.agent_reports;
drop policy if exists "auth_update_agent_reports" on public.agent_reports;
drop policy if exists "auth_delete_agent_reports" on public.agent_reports;
drop policy if exists "auth_insert_contributor_agent_reports" on public.agent_reports;
drop policy if exists "auth_update_contributor_own_agent_reports" on public.agent_reports;

create policy "auth_select_agent_reports"
  on public.agent_reports for select
  using (auth.uid() is not null);

create policy "auth_insert_agent_reports"
  on public.agent_reports for insert
  with check (public.can_write());

create policy "auth_update_agent_reports"
  on public.agent_reports for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_agent_reports"
  on public.agent_reports for delete
  using (public.can_write());

create policy "auth_insert_contributor_agent_reports"
  on public.agent_reports for insert
  with check (public.can_contribute() and coalesce(created_by, auth.uid()) = auth.uid());

create policy "auth_update_contributor_own_agent_reports"
  on public.agent_reports for update
  using (public.current_user_role() = 'Contributor' and created_by = auth.uid())
  with check (public.current_user_role() = 'Contributor' and created_by = auth.uid());
