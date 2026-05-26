-- Migration: 016_grant_shortlist_items
-- Additive manual grant discovery / watchlist workflow.
-- Safe to apply: creates a new table only; does not mutate imported grants.

create table if not exists public.grant_shortlist_items (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.grants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'New'
    check (status in ('New', 'Watching', 'Shortlisted', 'Apply', 'Skip', 'Archived', 'Not relevant')),
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  owner_name text,
  next_action text,
  notes text,
  saved_at timestamptz not null default now(),
  due_date text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_grant_shortlist_grant_id on public.grant_shortlist_items(grant_id);
create index if not exists idx_grant_shortlist_project_id on public.grant_shortlist_items(project_id);
create index if not exists idx_grant_shortlist_status on public.grant_shortlist_items(status);
create index if not exists idx_grant_shortlist_archived on public.grant_shortlist_items(archived_at);
create index if not exists idx_grant_shortlist_due_date on public.grant_shortlist_items(due_date);
create unique index if not exists idx_grant_shortlist_global_unique
  on public.grant_shortlist_items(grant_id)
  where project_id is null and archived_at is null;
create unique index if not exists idx_grant_shortlist_project_unique
  on public.grant_shortlist_items(grant_id, project_id)
  where project_id is not null and archived_at is null;

drop trigger if exists grant_shortlist_items_set_updated_at on public.grant_shortlist_items;
create trigger grant_shortlist_items_set_updated_at
  before update on public.grant_shortlist_items
  for each row execute procedure public.set_updated_at();

alter table public.grant_shortlist_items enable row level security;

drop policy if exists "auth_select_grant_shortlist_items" on public.grant_shortlist_items;
drop policy if exists "auth_insert_grant_shortlist_items" on public.grant_shortlist_items;
drop policy if exists "auth_update_grant_shortlist_items" on public.grant_shortlist_items;
drop policy if exists "auth_delete_grant_shortlist_items" on public.grant_shortlist_items;

create policy "auth_select_grant_shortlist_items"
  on public.grant_shortlist_items for select
  using (auth.uid() is not null);

create policy "auth_insert_grant_shortlist_items"
  on public.grant_shortlist_items for insert
  with check (public.can_contribute());

create policy "auth_update_grant_shortlist_items"
  on public.grant_shortlist_items for update
  using (public.can_contribute())
  with check (public.can_contribute());

create policy "auth_delete_grant_shortlist_items"
  on public.grant_shortlist_items for delete
  using (public.can_write());
