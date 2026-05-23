-- Migration: 015_peer_intelligence_system
-- V1.4 peer intelligence system. Additive only; no seed data.

alter table if exists public.peer_organizations
  add column if not exists relevance_to_playa text,
  add column if not exists similarity_score numeric check (similarity_score is null or (similarity_score >= 0 and similarity_score <= 100)),
  add column if not exists confidence text,
  add column if not exists known_funders text[] not null default '{}',
  add column if not exists source_url text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists import_source text,
  add column if not exists last_researched_at timestamptz;

create table if not exists public.peer_funding_records (
  id uuid primary key default gen_random_uuid(),
  peer_organization_id uuid not null references public.peer_organizations(id) on delete cascade,
  funder_id uuid references public.funders(id) on delete set null,
  funder_name text,
  year integer,
  amount numeric,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.peer_funding_records
  add column if not exists amount_min numeric,
  add column if not exists amount_max numeric,
  add column if not exists amount_exact numeric,
  add column if not exists award_year integer,
  add column if not exists purpose text,
  add column if not exists program_area text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists confidence text not null default 'manual',
  add column if not exists archived_at timestamptz;

create index if not exists idx_peer_funding_records_peer on public.peer_funding_records(peer_organization_id);
create index if not exists idx_peer_funding_records_funder_name on public.peer_funding_records(funder_name);
create index if not exists idx_peer_funding_records_award_year on public.peer_funding_records(award_year);
create index if not exists idx_peer_funding_records_archived on public.peer_funding_records(archived_at);
create index if not exists idx_peer_orgs_last_researched on public.peer_organizations(last_researched_at desc) where archived_at is null;
create index if not exists idx_peer_orgs_similarity on public.peer_organizations(similarity_score desc) where archived_at is null;

drop trigger if exists peer_funding_records_set_updated_at on public.peer_funding_records;
create trigger peer_funding_records_set_updated_at
  before update on public.peer_funding_records
  for each row execute procedure public.set_updated_at();

alter table public.peer_organizations enable row level security;
alter table public.peer_funding_records enable row level security;

-- No public anon policies are added here. Peer intelligence remains internal dashboard data.
