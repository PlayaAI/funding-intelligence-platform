-- Migration: 014_public_read_policies
-- Narrow public read access for the public website.
-- Does not expose grants, funders, applications, tasks, documents, matches, notes, or reports.

alter table public.projects enable row level security;
alter table public.proof_items enable row level security;

drop policy if exists "public_select_visible_projects" on public.projects;
create policy "public_select_visible_projects"
  on public.projects for select
  using (
    public_visibility = true
    and archived_at is null
  );

drop policy if exists "public_select_visible_proof_items" on public.proof_items;
create policy "public_select_visible_proof_items"
  on public.proof_items for select
  using (
    public_visibility = true
    and archived_at is null
  );
