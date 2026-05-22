-- Grant OS V1.0.1 - matching calibration and strategic decision layer

alter table if exists public.grant_matches
  add column if not exists decision_label text not null default 'needs_review',
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists deadline_status text not null default 'unknown',
  add column if not exists data_quality_flags jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'grant_matches'
  ) then
    alter table public.grant_matches
      drop constraint if exists grant_matches_decision_label_check;

    alter table public.grant_matches
      add constraint grant_matches_decision_label_check
      check (decision_label in ('apply_now', 'prepare_next', 'monitor', 'skip', 'track_next_cycle', 'needs_review'));

    alter table public.grant_matches
      drop constraint if exists grant_matches_deadline_status_check;

    alter table public.grant_matches
      add constraint grant_matches_deadline_status_check
      check (deadline_status in ('due_today', 'past_due', 'active', 'rolling', 'unknown'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'grant_matches'
  ) then
    create index if not exists idx_grant_matches_decision_label on public.grant_matches(decision_label);
    create index if not exists idx_grant_matches_deadline_status on public.grant_matches(deadline_status);
  end if;
end $$;
