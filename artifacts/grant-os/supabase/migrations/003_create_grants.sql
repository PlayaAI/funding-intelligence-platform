-- Migration: 003_create_grants
-- Grant OS V0.3 — Supabase-backed grants CRUD
-- Run after 001_create_projects.sql and 002_create_proof_items.sql

-- ============================================================
-- TABLE: grants
-- ============================================================

create table if not exists grants (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  funder_id               text,
  funder_name             text,
  related_project_id      uuid references projects(id) on delete set null,
  related_project_slug    text,
  deadline                text,
  next_deadline           text,
  amount_min              numeric,
  amount_max              numeric,
  amount_display          text,
  focus_areas             text[] not null default '{}',
  geography               text,
  eligibility             text,
  application_url         text,
  source_url              text,
  required_documents      text[] not null default '{}',
  application_questions   jsonb,
  status                  text not null default 'Researching'
    check (status in (
      'Planned', 'Researching', 'Applying', 'Submitted',
      'Awarded', 'Declined', 'Archived'
    )),
  priority                text,
  fit_score               integer,
  priority_score          integer,
  difficulty_score        integer,
  proof_readiness         text,
  application_readiness   text,
  is_top_three            boolean not null default false,
  notes                   text,
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_grants_status              on grants(status);
create index if not exists idx_grants_deadline            on grants(deadline);
create index if not exists idx_grants_related_project     on grants(related_project_id);
create index if not exists idx_grants_is_top_three        on grants(is_top_three);
create index if not exists idx_grants_archived            on grants(archived_at);

-- ============================================================
-- UPDATED_AT trigger (reuses set_updated_at() from migration 001)
-- ============================================================

drop trigger if exists grants_set_updated_at on grants;
create trigger grants_set_updated_at
  before update on grants
  for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- ⚠️  DEVELOPMENT / DEMO POLICIES — REPLACE BEFORE PRODUCTION ⚠️
--
-- These policies allow full anon read/write so the Vite frontend
-- can operate without authentication during development.
--
-- ============================================================

alter table grants enable row level security;

create policy "demo_anon_select_grants"
  on grants for select
  using (true);

create policy "demo_anon_insert_grants"
  on grants for insert
  with check (true);

create policy "demo_anon_update_grants"
  on grants for update
  using (true);

create policy "demo_anon_delete_grants"
  on grants for delete
  using (true);

-- ============================================================
-- SEED DATA
-- Fixed UUIDs map legacy mock ids g1–g9 for future application/task linking.
-- ============================================================

insert into grants (
  id, title, funder_id, funder_name,
  related_project_id, related_project_slug,
  deadline, amount_min, amount_max,
  focus_areas, geography, eligibility, application_url,
  status, fit_score, priority_score, difficulty_score,
  is_top_three, notes
) values
  (
    '11111111-1111-4111-8111-111111110001',
    'MIT Solve — Indigenous Communities Fellowship',
    'f1', 'MIT Solve',
    (select id from projects where slug = 'connect-app' limit 1), 'connect-app',
    '2026-06-15', 10000, 150000,
    array['Community Technology', 'Social Connection', 'Indigenous Innovation'],
    'Global',
    'Social enterprises, nonprofits, and community organizations working at the intersection of technology and community flourishing.',
    'https://solve.mit.edu/challenges',
    'Applying', 88, 92, 55,
    true,
    'Strong fit with human connection focus. Need to emphasize field testing at Burning Man and community validation.'
  ),
  (
    '11111111-1111-4111-8111-111111110002',
    'Mozilla Foundation — Responsible Technology',
    'f2', 'Mozilla Foundation',
    (select id from projects where slug = 'connect-app' limit 1), 'connect-app',
    '2026-07-01', 25000, 50000,
    array['Humane Technology', 'Privacy', 'Digital Wellbeing'],
    'Global / North America',
    'Organizations building technology that centers human values, privacy, and wellbeing over engagement metrics.',
    null,
    'Researching', 82, 78, 45,
    true,
    'Excellent mission alignment. Connect App''s ''put the phone down'' feature is directly relevant.'
  ),
  (
    '11111111-1111-4111-8111-111111110003',
    'Knight Foundation — Tech for Engagement',
    'f3', 'Knight Foundation',
    (select id from projects where slug = 'ikigai' limit 1), 'ikigai',
    '2026-08-30', 50000, 300000,
    array['Civic Technology', 'Community Engagement', 'Innovation'],
    'United States',
    'Nonprofits and social enterprises using technology to strengthen community engagement and civic participation.',
    null,
    'Researching', 70, 65, 60,
    false,
    'Potentially good fit for the Ikigai app civic angle. Need to assess eligibility for unincorporated group.'
  ),
  (
    '11111111-1111-4111-8111-111111110004',
    'Wellspring Foundation — Loneliness & Social Health',
    'f4', 'Wellspring Foundation',
    (select id from projects where slug = 'connect-app' limit 1), 'connect-app',
    '2026-05-30', 5000, 25000,
    array['Loneliness', 'Social Health', 'Community'],
    'California',
    'Grassroots organizations and projects addressing social isolation and loneliness.',
    null,
    'Applying', 90, 85, 35,
    true,
    'URGENT — deadline May 30. Draft 80% complete. Missing letters of support and budget narrative.'
  ),
  (
    '11111111-1111-4111-8111-111111110005',
    'Robert Wood Johnson Foundation — Health Equity',
    'f5', 'Robert Wood Johnson Foundation',
    (select id from projects where slug = 'connect-app' limit 1), 'connect-app',
    '2026-09-15', 100000, 500000,
    array['Health Equity', 'Mental Health', 'Community Wellbeing'],
    'United States',
    '501(c)(3) organizations with demonstrated impact in health equity.',
    null,
    'Planned', 65, 55, 75,
    false,
    'Large grant but requires 501c3 status. Research fiscal sponsorship options.'
  ),
  (
    '11111111-1111-4111-8111-111111110006',
    'Burning Man Project — Arts & Community Innovation',
    'f6', 'Burning Man Project',
    (select id from projects where slug = 'oracle' limit 1), 'oracle',
    '2026-04-01', 1000, 15000,
    array['Arts', 'Community Innovation', 'Participatory Culture'],
    'Black Rock City / Global',
    'Community projects connected to Burning Man culture and principles.',
    'https://burningman.org/grants',
    'Submitted', 85, 72, 30,
    false,
    'Application submitted April 1. Awaiting decision. Strong proof from 2024 demo.'
  ),
  (
    '11111111-1111-4111-8111-111111110007',
    'NEA — Technology & Human Flourishing',
    'f7', 'National Endowment for the Arts',
    (select id from projects where slug = 'oracle' limit 1), 'oracle',
    '2026-10-15', 10000, 100000,
    array['Arts', 'Technology', 'Community Participation'],
    'United States',
    'Arts organizations and projects at the intersection of technology and community arts.',
    null,
    'Planned', 60, 50, 65,
    false,
    null
  ),
  (
    '11111111-1111-4111-8111-111111110008',
    'MacArthur Foundation — Field Initiative',
    'f8', 'MacArthur Foundation',
    null, null,
    '2026-11-01', 250000, 1000000,
    array['Social Innovation', 'Technology', 'Equity'],
    'Global',
    'By invitation or letter of inquiry. Established organizations with demonstrated field leadership.',
    null,
    'Archived', 50, 30, 90,
    false,
    'Likely out of scope for current stage. Archived for future consideration.'
  ),
  (
    '11111111-1111-4111-8111-111111110009',
    'State Dept. — Democracy & Civic Technology',
    'f9', 'U.S. Department of State',
    null, null,
    '2025-12-01', 50000, 200000,
    array['Democracy', 'Civic Technology', 'Digital Rights'],
    'United States',
    'Nonprofits and social enterprises in civic technology space.',
    null,
    'Declined', 55, 40, 80,
    false,
    'Missed deadline — submitted too late. Important lesson for future applications.'
  )
on conflict (id) do nothing;
