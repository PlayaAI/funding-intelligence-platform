-- Grant OS V1.0 - deterministic grant matching/readiness engine

create table if not exists public.grant_matches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  funder_id uuid null references public.funders(id) on delete set null,
  match_score integer not null default 0,
  match_tier text not null default 'needs_review',
  readiness_score integer not null default 0,
  urgency_score integer not null default 0,
  evidence_score integer not null default 0,
  fit_reasons jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  hidden_at timestamptz null,
  saved_at timestamptz null,
  dismissed_reason text null,
  generated_by text not null default 'rules_engine',
  generated_at timestamptz not null default now(),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grant_matches_project_grant_unique unique(project_id, grant_id),
  constraint grant_matches_match_score_check check (match_score >= 0 and match_score <= 100),
  constraint grant_matches_readiness_score_check check (readiness_score >= 0 and readiness_score <= 100),
  constraint grant_matches_urgency_score_check check (urgency_score >= 0 and urgency_score <= 100),
  constraint grant_matches_evidence_score_check check (evidence_score >= 0 and evidence_score <= 100),
  constraint grant_matches_tier_check check (match_tier in ('best', 'strong', 'good', 'maybe', 'weak', 'needs_review')),
  constraint grant_matches_status_check check (status in ('active', 'saved', 'hidden', 'dismissed', 'applied'))
);

create index if not exists idx_grant_matches_project on public.grant_matches(project_id);
create index if not exists idx_grant_matches_grant on public.grant_matches(grant_id);
create index if not exists idx_grant_matches_funder on public.grant_matches(funder_id);
create index if not exists idx_grant_matches_status on public.grant_matches(status);
create index if not exists idx_grant_matches_tier on public.grant_matches(match_tier);
create index if not exists idx_grant_matches_score on public.grant_matches(match_score desc);
create index if not exists idx_grant_matches_generated_at on public.grant_matches(generated_at desc);

drop trigger if exists grant_matches_set_updated_at on public.grant_matches;
create trigger grant_matches_set_updated_at
  before update on public.grant_matches
  for each row execute procedure public.set_updated_at();

alter table public.grant_matches enable row level security;

drop policy if exists "auth_select_grant_matches" on public.grant_matches;
drop policy if exists "auth_insert_grant_matches" on public.grant_matches;
drop policy if exists "auth_update_grant_matches" on public.grant_matches;
drop policy if exists "auth_delete_grant_matches" on public.grant_matches;
drop policy if exists "auth_update_contributor_grant_matches" on public.grant_matches;

create policy "auth_select_grant_matches"
  on public.grant_matches for select
  using (auth.uid() is not null);

create policy "auth_insert_grant_matches"
  on public.grant_matches for insert
  with check (public.can_write());

create policy "auth_update_grant_matches"
  on public.grant_matches for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_grant_matches"
  on public.grant_matches for delete
  using (public.can_write());

-- Contributors can perform low-risk curation actions from the UI
-- (save, hide, dismiss, review) but cannot create/delete generated matches.
create policy "auth_update_contributor_grant_matches"
  on public.grant_matches for update
  using (public.current_user_role() = 'Contributor')
  with check (
    public.current_user_role() = 'Contributor'
    and status in ('active', 'saved', 'hidden', 'dismissed')
    and generated_by = 'rules_engine'
  );
