-- SELECT-only RLS/privacy audit for Grant OS.
-- Run in Supabase SQL editor as an admin reviewer. No mutations.

-- 1) Tables with public/anon policies. Expected public anon SELECT only:
--    projects where public_visibility=true and archived_at is null
--    proof_items where public_visibility=true and archived_at is null
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and ('anon' = any(roles) or 'public' = any(roles) or roles = '{public}')
order by tablename, policyname;

-- 2) Demo policies that must not exist in staging/production.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and policyname ilike 'demo_%'
order by tablename, policyname;

-- 3) Dashboard/private tables should have RLS enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'applications', 'application_questions', 'application_required_documents', 'tasks',
    'documents', 'funders', 'grants', 'grant_matches', 'agent_notes', 'agent_reports',
    'agent_activity', 'peer_organizations', 'peer_funding_records', 'import_runs',
    'import_errors', 'grant_shortlist_items'
  )
order by c.relname;

-- 4) Policies that contain broad `using (true)` / `with check (true)`.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
order by tablename, policyname;
