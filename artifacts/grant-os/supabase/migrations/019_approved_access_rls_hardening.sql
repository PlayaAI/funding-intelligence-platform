-- Migration: 019_approved_access_rls_hardening
-- Implements V2.8A strict access controls for pending/rejected/disabled users.

-- 1. Ensure `is_approved()` helper exists and is up to date
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and access_status = 'approved'
  );
$$;

grant execute on function public.is_approved() to authenticated;

-- 2. Update `current_user_role()` to only return role if approved
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and access_status = 'approved';
$$;

-- 3. Replace `auth.uid() is not null` with `public.is_approved()` on internal read policies

-- projects
drop policy if exists "auth_select_projects" on public.projects;
create policy "auth_select_projects" on public.projects for select using (public.is_approved());

-- proof_items
drop policy if exists "auth_select_proof_items" on public.proof_items;
create policy "auth_select_proof_items" on public.proof_items for select using (public.is_approved());

-- grants
drop policy if exists "auth_select_grants" on public.grants;
create policy "auth_select_grants" on public.grants for select using (public.is_approved());

-- funders
drop policy if exists "auth_select_funders" on public.funders;
create policy "auth_select_funders" on public.funders for select using (public.is_approved());

-- peer_organizations
drop policy if exists "auth_select_peer_orgs" on public.peer_organizations;
create policy "auth_select_peer_orgs" on public.peer_organizations for select using (public.is_approved());

-- peer_funding_records
drop policy if exists "auth_select_peer_funding" on public.peer_funding_records;
create policy "auth_select_peer_funding" on public.peer_funding_records for select using (public.is_approved());

-- applications
drop policy if exists "auth_select_applications" on public.applications;
create policy "auth_select_applications" on public.applications for select using (public.is_approved());

-- application_questions
drop policy if exists "auth_select_app_questions" on public.application_questions;
create policy "auth_select_app_questions" on public.application_questions for select using (public.is_approved());

-- application_required_documents
drop policy if exists "auth_select_app_req_docs" on public.application_required_documents;
create policy "auth_select_app_req_docs" on public.application_required_documents for select using (public.is_approved());

-- tasks
drop policy if exists "auth_select_tasks" on public.tasks;
create policy "auth_select_tasks" on public.tasks for select using (public.is_approved());

-- import_runs
drop policy if exists "auth_select_import_runs" on public.import_runs;
create policy "auth_select_import_runs" on public.import_runs for select using (public.is_approved());

-- import_errors
drop policy if exists "auth_select_import_errors" on public.import_errors;
create policy "auth_select_import_errors" on public.import_errors for select using (public.is_approved());

-- custom_fields
drop policy if exists "auth_select_custom_fields" on public.custom_fields;
create policy "auth_select_custom_fields" on public.custom_fields for select using (public.is_approved());

-- agent_notes
drop policy if exists "auth_select_agent_notes" on public.agent_notes;
create policy "auth_select_agent_notes" on public.agent_notes for select using (public.is_approved());

-- agent_activity_logs
drop policy if exists "auth_select_agent_activity_logs" on public.agent_activity_logs;
create policy "auth_select_agent_activity_logs" on public.agent_activity_logs for select using (public.is_approved());

-- agent_reports
drop policy if exists "auth_select_agent_reports" on public.agent_reports;
create policy "auth_select_agent_reports" on public.agent_reports for select using (public.is_approved());

-- documents
drop policy if exists "auth_select_documents" on public.documents;
create policy "auth_select_documents" on public.documents for select using (public.is_approved());

-- grant_matches
drop policy if exists "auth_select_grant_matches" on public.grant_matches;
create policy "auth_select_grant_matches" on public.grant_matches for select using (public.is_approved());

-- grant_shortlist_items
drop policy if exists "auth_select_grant_shortlist_items" on public.grant_shortlist_items;
create policy "auth_select_grant_shortlist_items" on public.grant_shortlist_items for select using (public.is_approved());
