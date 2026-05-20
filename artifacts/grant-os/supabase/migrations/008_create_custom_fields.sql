-- Migration: 008_create_custom_fields
-- Grant OS V0.7.2 — Custom field definitions
--
-- Field definitions only. This does not attach custom fields to entity forms yet.

create table if not exists public.custom_fields (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  field_type  text not null
                check (field_type in (
                  'short_text',
                  'long_text',
                  'amount',
                  'date',
                  'single_select',
                  'multi_select',
                  'number',
                  'url'
                )),
  applies_to  text not null
                check (applies_to in (
                  'opportunities',
                  'funders',
                  'projects',
                  'applications'
                )),
  options     jsonb,
  created_by  uuid references public.profiles(id) on delete set null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_custom_fields_applies_to on public.custom_fields(applies_to);
create index if not exists idx_custom_fields_archived_at on public.custom_fields(archived_at);
create index if not exists idx_custom_fields_created_by on public.custom_fields(created_by);
create unique index if not exists idx_custom_fields_unique_active_name_target
  on public.custom_fields (lower(name), applies_to)
  where archived_at is null;

drop trigger if exists custom_fields_set_updated_at on public.custom_fields;
create trigger custom_fields_set_updated_at
  before update on public.custom_fields
  for each row execute procedure public.set_updated_at();

alter table public.custom_fields enable row level security;

drop policy if exists "auth_select_custom_fields" on public.custom_fields;
drop policy if exists "auth_insert_custom_fields" on public.custom_fields;
drop policy if exists "auth_update_custom_fields" on public.custom_fields;
drop policy if exists "auth_delete_custom_fields" on public.custom_fields;

create policy "auth_select_custom_fields"
  on public.custom_fields for select
  using (auth.uid() is not null);

create policy "auth_insert_custom_fields"
  on public.custom_fields for insert
  with check (public.can_write());

create policy "auth_update_custom_fields"
  on public.custom_fields for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_custom_fields"
  on public.custom_fields for delete
  using (public.can_write());

insert into public.custom_fields (name, field_type, applies_to, options)
values
  ('Estimated Ask', 'amount', 'opportunities', null),
  ('Fit Category', 'single_select', 'opportunities', '["High", "Medium", "Low"]'::jsonb),
  ('Funder Location', 'short_text', 'funders', null),
  ('Funder Portal Website', 'url', 'funders', null),
  ('Funder Type', 'single_select', 'funders', '["Foundation", "Corporate", "Government", "Individual", "Other"]'::jsonb),
  ('Priority', 'single_select', 'opportunities', '["High", "Medium", "Low"]'::jsonb),
  ('Strategic Fit / Proposal Angle', 'long_text', 'opportunities', null),
  ('Verification Date', 'date', 'opportunities', null)
on conflict do nothing;
