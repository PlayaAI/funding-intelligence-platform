-- Migration: 007_create_imports
-- Grant OS V0.7 — Instrumentl importer audit tables
--
-- Adds simple import history/error logging. Actual grants/funders writes continue
-- to use the existing V0.6 RLS policies: Admin and Grant Lead can write.

create table if not exists public.import_runs (
  id              uuid primary key default gen_random_uuid(),
  source          text not null default 'instrumentl',
  import_type     text not null
                    check (import_type in (
                      'instrumentl_opportunities_csv',
                      'instrumentl_opportunities_json',
                      'instrumentl_funders_csv',
                      'instrumentl_funders_json'
                    )),
  file_name       text,
  status          text not null default 'completed'
                    check (status in ('completed', 'completed_with_errors', 'failed')),
  total_rows      integer not null default 0,
  created_count   integer not null default 0,
  updated_count   integer not null default 0,
  skipped_count   integer not null default 0,
  error_count     integer not null default 0,
  summary         jsonb,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_import_runs_created_at on public.import_runs(created_at desc);
create index if not exists idx_import_runs_import_type on public.import_runs(import_type);
create index if not exists idx_import_runs_created_by on public.import_runs(created_by);

create table if not exists public.import_errors (
  id              uuid primary key default gen_random_uuid(),
  import_run_id   uuid not null references public.import_runs(id) on delete cascade,
  row_index       integer,
  message         text not null,
  raw_row         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_import_errors_run on public.import_errors(import_run_id);

alter table public.import_runs enable row level security;
alter table public.import_errors enable row level security;

drop policy if exists "auth_select_import_runs" on public.import_runs;
drop policy if exists "auth_insert_import_runs" on public.import_runs;
drop policy if exists "auth_select_import_errors" on public.import_errors;
drop policy if exists "auth_insert_import_errors" on public.import_errors;

create policy "auth_select_import_runs"
  on public.import_runs for select
  using (auth.uid() is not null);

create policy "auth_insert_import_runs"
  on public.import_runs for insert
  with check (public.can_write());

create policy "auth_select_import_errors"
  on public.import_errors for select
  using (auth.uid() is not null);

create policy "auth_insert_import_errors"
  on public.import_errors for insert
  with check (public.can_write());
