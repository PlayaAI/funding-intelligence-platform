-- Migration: 006_auth_roles_rls
-- Grant OS V0.6 — Supabase Auth profiles, role helpers, secure RLS
--
-- ═══════════════════════════════════════════════════════════════════════════
-- BEFORE RUNNING: create your first user in Supabase Dashboard
--   Authentication → Users → Add user (email + password)
--
-- AFTER RUNNING: promote that user to Admin (see bottom of this file)
--
-- This migration DROPS demo anon policies. Dashboard tables require login.
-- Public website uses mock data and is unaffected.
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'Viewer'
                check (role in ('Admin', 'Grant Lead', 'Contributor', 'Viewer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    'Viewer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Prevent non-admins from changing their own role or email via client updates
create or replace function public.profiles_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update
  before update on public.profiles
  for each row execute procedure public.profiles_guard_self_update();

-- ============================================================
-- ROLE HELPER FUNCTIONS
-- ============================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'Admin';
$$;

create or replace function public.is_grant_lead()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'Grant Lead';
$$;

create or replace function public.can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('Admin', 'Grant Lead');
$$;

create or replace function public.can_contribute()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('Admin', 'Grant Lead', 'Contributor');
$$;

create or replace function public.is_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'Viewer';
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_grant_lead() to authenticated;
grant execute on function public.can_write() to authenticated;
grant execute on function public.can_contribute() to authenticated;
grant execute on function public.is_viewer() to authenticated;

-- ============================================================
-- PROFILES RLS
-- ============================================================

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- DROP DEMO ANON POLICIES
-- ============================================================

-- proof_items
drop policy if exists "demo_anon_select" on public.proof_items;
drop policy if exists "demo_anon_insert" on public.proof_items;
drop policy if exists "demo_anon_update" on public.proof_items;
drop policy if exists "demo_anon_delete" on public.proof_items;

-- grants
drop policy if exists "demo_anon_select_grants" on public.grants;
drop policy if exists "demo_anon_insert_grants" on public.grants;
drop policy if exists "demo_anon_update_grants" on public.grants;
drop policy if exists "demo_anon_delete_grants" on public.grants;

-- funders
drop policy if exists "demo_anon_select_funders" on public.funders;
drop policy if exists "demo_anon_insert_funders" on public.funders;
drop policy if exists "demo_anon_update_funders" on public.funders;
drop policy if exists "demo_anon_delete_funders" on public.funders;

-- peer_organizations
drop policy if exists "demo_anon_select_peer_orgs" on public.peer_organizations;
drop policy if exists "demo_anon_insert_peer_orgs" on public.peer_organizations;
drop policy if exists "demo_anon_update_peer_orgs" on public.peer_organizations;
drop policy if exists "demo_anon_delete_peer_orgs" on public.peer_organizations;

-- peer_funding_records
drop policy if exists "demo_anon_select_peer_funding" on public.peer_funding_records;
drop policy if exists "demo_anon_insert_peer_funding" on public.peer_funding_records;
drop policy if exists "demo_anon_update_peer_funding" on public.peer_funding_records;
drop policy if exists "demo_anon_delete_peer_funding" on public.peer_funding_records;

-- applications
drop policy if exists "demo_anon_select_applications" on public.applications;
drop policy if exists "demo_anon_insert_applications" on public.applications;
drop policy if exists "demo_anon_update_applications" on public.applications;
drop policy if exists "demo_anon_delete_applications" on public.applications;

-- application_questions
drop policy if exists "demo_anon_select_app_questions" on public.application_questions;
drop policy if exists "demo_anon_insert_app_questions" on public.application_questions;
drop policy if exists "demo_anon_update_app_questions" on public.application_questions;
drop policy if exists "demo_anon_delete_app_questions" on public.application_questions;

-- application_required_documents
drop policy if exists "demo_anon_select_app_req_docs" on public.application_required_documents;
drop policy if exists "demo_anon_insert_app_req_docs" on public.application_required_documents;
drop policy if exists "demo_anon_update_app_req_docs" on public.application_required_documents;
drop policy if exists "demo_anon_delete_app_req_docs" on public.application_required_documents;

-- tasks
drop policy if exists "demo_anon_select_tasks" on public.tasks;
drop policy if exists "demo_anon_insert_tasks" on public.tasks;
drop policy if exists "demo_anon_update_tasks" on public.tasks;
drop policy if exists "demo_anon_delete_tasks" on public.tasks;

-- ============================================================
-- AUTHENTICATED RLS — projects
-- ============================================================

alter table public.projects enable row level security;

drop policy if exists "auth_select_projects" on public.projects;
drop policy if exists "auth_insert_projects" on public.projects;
drop policy if exists "auth_update_projects" on public.projects;
drop policy if exists "auth_delete_projects" on public.projects;

create policy "auth_select_projects"
  on public.projects for select
  using (auth.uid() is not null);

create policy "auth_insert_projects"
  on public.projects for insert
  with check (public.can_write());

create policy "auth_update_projects"
  on public.projects for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_projects"
  on public.projects for delete
  using (public.can_write());

-- ============================================================
-- AUTHENTICATED RLS — proof_items
-- ============================================================

alter table public.proof_items enable row level security;

drop policy if exists "auth_select_proof_items" on public.proof_items;
drop policy if exists "auth_insert_proof_items" on public.proof_items;
drop policy if exists "auth_update_proof_items" on public.proof_items;
drop policy if exists "auth_delete_proof_items" on public.proof_items;
drop policy if exists "auth_insert_contributor_proof_items" on public.proof_items;
drop policy if exists "auth_update_contributor_proof_items" on public.proof_items;

create policy "auth_select_proof_items"
  on public.proof_items for select
  using (auth.uid() is not null);

create policy "auth_insert_proof_items"
  on public.proof_items for insert
  with check (public.can_write());

create policy "auth_update_proof_items"
  on public.proof_items for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_proof_items"
  on public.proof_items for delete
  using (public.can_write());

create policy "auth_insert_contributor_proof_items"
  on public.proof_items for insert
  with check (public.can_contribute());

create policy "auth_update_contributor_proof_items"
  on public.proof_items for update
  using (public.can_contribute())
  with check (public.can_contribute());

-- ============================================================
-- AUTHENTICATED RLS — grants
-- ============================================================

alter table public.grants enable row level security;

drop policy if exists "auth_select_grants" on public.grants;
drop policy if exists "auth_insert_grants" on public.grants;
drop policy if exists "auth_update_grants" on public.grants;
drop policy if exists "auth_delete_grants" on public.grants;

create policy "auth_select_grants"
  on public.grants for select
  using (auth.uid() is not null);

create policy "auth_insert_grants"
  on public.grants for insert
  with check (public.can_write());

create policy "auth_update_grants"
  on public.grants for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_grants"
  on public.grants for delete
  using (public.can_write());

-- ============================================================
-- AUTHENTICATED RLS — funders
-- ============================================================

alter table public.funders enable row level security;

drop policy if exists "auth_select_funders" on public.funders;
drop policy if exists "auth_insert_funders" on public.funders;
drop policy if exists "auth_update_funders" on public.funders;
drop policy if exists "auth_delete_funders" on public.funders;

create policy "auth_select_funders"
  on public.funders for select
  using (auth.uid() is not null);

create policy "auth_insert_funders"
  on public.funders for insert
  with check (public.can_write());

create policy "auth_update_funders"
  on public.funders for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_funders"
  on public.funders for delete
  using (public.can_write());

-- ============================================================
-- AUTHENTICATED RLS — peer_organizations
-- ============================================================

alter table public.peer_organizations enable row level security;

drop policy if exists "auth_select_peer_orgs" on public.peer_organizations;
drop policy if exists "auth_insert_peer_orgs" on public.peer_organizations;
drop policy if exists "auth_update_peer_orgs" on public.peer_organizations;
drop policy if exists "auth_delete_peer_orgs" on public.peer_organizations;

create policy "auth_select_peer_orgs"
  on public.peer_organizations for select
  using (auth.uid() is not null);

create policy "auth_insert_peer_orgs"
  on public.peer_organizations for insert
  with check (public.can_write());

create policy "auth_update_peer_orgs"
  on public.peer_organizations for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_peer_orgs"
  on public.peer_organizations for delete
  using (public.can_write());

-- ============================================================
-- AUTHENTICATED RLS — peer_funding_records
-- ============================================================

alter table public.peer_funding_records enable row level security;

drop policy if exists "auth_select_peer_funding" on public.peer_funding_records;
drop policy if exists "auth_insert_peer_funding" on public.peer_funding_records;
drop policy if exists "auth_update_peer_funding" on public.peer_funding_records;
drop policy if exists "auth_delete_peer_funding" on public.peer_funding_records;

create policy "auth_select_peer_funding"
  on public.peer_funding_records for select
  using (auth.uid() is not null);

create policy "auth_insert_peer_funding"
  on public.peer_funding_records for insert
  with check (public.can_write());

create policy "auth_update_peer_funding"
  on public.peer_funding_records for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_peer_funding"
  on public.peer_funding_records for delete
  using (public.can_write());

-- ============================================================
-- AUTHENTICATED RLS — applications
-- ============================================================

alter table public.applications enable row level security;

drop policy if exists "auth_select_applications" on public.applications;
drop policy if exists "auth_insert_applications" on public.applications;
drop policy if exists "auth_update_applications" on public.applications;
drop policy if exists "auth_delete_applications" on public.applications;
drop policy if exists "auth_update_contributor_applications" on public.applications;

create policy "auth_select_applications"
  on public.applications for select
  using (auth.uid() is not null);

create policy "auth_insert_applications"
  on public.applications for insert
  with check (public.can_write());

create policy "auth_update_applications"
  on public.applications for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_applications"
  on public.applications for delete
  using (public.can_write());

create policy "auth_update_contributor_applications"
  on public.applications for update
  using (public.can_contribute())
  with check (public.can_contribute());

-- ============================================================
-- AUTHENTICATED RLS — application_questions
-- ============================================================

alter table public.application_questions enable row level security;

drop policy if exists "auth_select_app_questions" on public.application_questions;
drop policy if exists "auth_insert_app_questions" on public.application_questions;
drop policy if exists "auth_update_app_questions" on public.application_questions;
drop policy if exists "auth_delete_app_questions" on public.application_questions;
drop policy if exists "auth_insert_contributor_app_questions" on public.application_questions;
drop policy if exists "auth_update_contributor_app_questions" on public.application_questions;

create policy "auth_select_app_questions"
  on public.application_questions for select
  using (auth.uid() is not null);

create policy "auth_insert_app_questions"
  on public.application_questions for insert
  with check (public.can_write());

create policy "auth_update_app_questions"
  on public.application_questions for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_app_questions"
  on public.application_questions for delete
  using (public.can_write());

create policy "auth_insert_contributor_app_questions"
  on public.application_questions for insert
  with check (public.can_contribute());

create policy "auth_update_contributor_app_questions"
  on public.application_questions for update
  using (public.can_contribute())
  with check (public.can_contribute());

-- ============================================================
-- AUTHENTICATED RLS — application_required_documents
-- ============================================================

alter table public.application_required_documents enable row level security;

drop policy if exists "auth_select_app_req_docs" on public.application_required_documents;
drop policy if exists "auth_insert_app_req_docs" on public.application_required_documents;
drop policy if exists "auth_update_app_req_docs" on public.application_required_documents;
drop policy if exists "auth_delete_app_req_docs" on public.application_required_documents;
drop policy if exists "auth_insert_contributor_app_req_docs" on public.application_required_documents;
drop policy if exists "auth_update_contributor_app_req_docs" on public.application_required_documents;

create policy "auth_select_app_req_docs"
  on public.application_required_documents for select
  using (auth.uid() is not null);

create policy "auth_insert_app_req_docs"
  on public.application_required_documents for insert
  with check (public.can_write());

create policy "auth_update_app_req_docs"
  on public.application_required_documents for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_app_req_docs"
  on public.application_required_documents for delete
  using (public.can_write());

create policy "auth_insert_contributor_app_req_docs"
  on public.application_required_documents for insert
  with check (public.can_contribute());

create policy "auth_update_contributor_app_req_docs"
  on public.application_required_documents for update
  using (public.can_contribute())
  with check (public.can_contribute());

-- ============================================================
-- AUTHENTICATED RLS — tasks
-- ============================================================

alter table public.tasks enable row level security;

drop policy if exists "auth_select_tasks" on public.tasks;
drop policy if exists "auth_insert_tasks" on public.tasks;
drop policy if exists "auth_update_tasks" on public.tasks;
drop policy if exists "auth_delete_tasks" on public.tasks;
drop policy if exists "auth_insert_contributor_tasks" on public.tasks;
drop policy if exists "auth_update_contributor_tasks" on public.tasks;

create policy "auth_select_tasks"
  on public.tasks for select
  using (auth.uid() is not null);

create policy "auth_insert_tasks"
  on public.tasks for insert
  with check (public.can_write());

create policy "auth_update_tasks"
  on public.tasks for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_tasks"
  on public.tasks for delete
  using (public.can_write());

create policy "auth_insert_contributor_tasks"
  on public.tasks for insert
  with check (public.can_contribute());

create policy "auth_update_contributor_tasks"
  on public.tasks for update
  using (public.can_contribute())
  with check (public.can_contribute());

-- ============================================================
-- BACKFILL PROFILES FOR EXISTING AUTH USERS (safe to re-run)
-- ============================================================

insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  'Viewer'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- ============================================================
-- FIRST ADMIN + REPAIR SQL (run manually in SQL Editor)
-- ============================================================
--
-- 1) Create user first (if not done):
--    Supabase Dashboard → Authentication → Users → Add user
--
-- 2) Promote to Admin:
--
--    update public.profiles
--    set role = 'Admin',
--        full_name = 'Your Name'
--    where email = 'you@example.com';
--
-- 3) Repair missing profile for an existing auth user:
--
--    insert into public.profiles (id, email, full_name, role)
--    select id, coalesce(email, ''), null, 'Viewer'
--    from auth.users
--    where email = 'user@example.com'
--    on conflict (id) do nothing;
--
-- 4) Verify:
--
--    select id, email, role from public.profiles order by created_at;
