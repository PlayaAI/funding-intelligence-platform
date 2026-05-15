-- Migration: 002_create_proof_items
-- Creates the proof_items table for Grant OS V0.2
-- Run this in your Supabase SQL editor (after 001_create_projects.sql)

-- ============================================================
-- TABLE: proof_items
-- ============================================================

create table if not exists proof_items (
  id                uuid primary key default gen_random_uuid(),

  -- Relationship to projects (nullable — items can exist without a project)
  project_id        uuid references projects(id) on delete set null,

  -- Core fields
  title             text not null,
  type              text not null check (type in (
                      'workshop', 'app_demo', 'document', 'metric',
                      'testimonial', 'case_study', 'media'
                    )),
  description       text,

  -- Date as a human-readable string (e.g. "August 2024", "2023–2024")
  date              text,

  -- Optional media / document links
  media_url         text,
  document_url      text,

  -- Flexible key/value metrics (e.g. {"attendees": 120, "sessions": 4})
  metrics           jsonb,

  -- Tags stored as a Postgres array
  tags              text[] not null default '{}',

  -- Grant application context
  grant_relevance   text,

  -- Visibility / lifecycle
  public_visibility boolean not null default true,
  archived_at       timestamptz,

  -- Timestamps
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_proof_items_project     on proof_items(project_id);
create index if not exists idx_proof_items_type        on proof_items(type);
create index if not exists idx_proof_items_archived    on proof_items(archived_at);
create index if not exists idx_proof_items_public      on proof_items(public_visibility);
create index if not exists idx_proof_items_created     on proof_items(created_at desc);

-- ============================================================
-- UPDATED_AT trigger
-- Reuses set_updated_at() created in migration 001.
-- ============================================================

drop trigger if exists proof_items_set_updated_at on proof_items;
create trigger proof_items_set_updated_at
  before update on proof_items
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
-- In the real auth phase, disable these policies and replace with
-- authenticated role-based policies, for example:
--
--   create policy "Authenticated users can select"
--     on proof_items for select
--     using (auth.role() = 'authenticated');
--
--   create policy "Authenticated users can insert"
--     on proof_items for insert
--     with check (auth.role() = 'authenticated');
--
--   create policy "Authenticated users can update"
--     on proof_items for update
--     using (auth.role() = 'authenticated');
--
--   create policy "Authenticated users can delete"
--     on proof_items for delete
--     using (auth.role() = 'authenticated');
--
-- ============================================================

alter table proof_items enable row level security;

-- DEMO POLICY: allow anon SELECT (read all non-archived items)
create policy "demo_anon_select"
  on proof_items for select
  using (true);

-- DEMO POLICY: allow anon INSERT
create policy "demo_anon_insert"
  on proof_items for insert
  with check (true);

-- DEMO POLICY: allow anon UPDATE
create policy "demo_anon_update"
  on proof_items for update
  using (true);

-- DEMO POLICY: allow anon DELETE
create policy "demo_anon_delete"
  on proof_items for delete
  using (true);

-- ============================================================
-- SEED DATA
-- Matches the 9 existing mock proof items so the dashboard looks
-- populated immediately after running this migration.
-- Project IDs are resolved from slugs via subquery.
-- ============================================================

insert into proof_items
  (project_id, title, type, description, date, tags, grant_relevance, public_visibility)
values
  (
    (select id from projects where slug = 'connect-app' limit 1),
    'Connect App Field Sessions — Burning Man 2024',
    'app_demo',
    'Live field testing of the guided connection protocol with community participants during Burning Man 2024. Multiple sessions completed in a real-world intentional community setting with positive qualitative feedback.',
    'August 2024',
    array['human connection', 'field test', 'humane technology'],
    'Primary proof of concept for Wellspring Foundation and MIT Solve applications — demonstrates real-world community validation of the core connection methodology.',
    true
  ),
  (
    (select id from projects where slug = 'biohack-burn' limit 1),
    'Biohack Your Burn Workshop',
    'workshop',
    'Pre-event workshop covering sleep optimization, nutrition, heat adaptation, and community care strategies for Burning Man participants. Delivered in-person with workshop guide produced.',
    'July 2024',
    array['wellness', 'workshop', 'education'],
    'Demonstrates organizational capacity to design and deliver structured educational workshops — relevant to NEA and community grant applications.',
    true
  ),
  (
    (select id from projects where slug = 'oracle' limit 1),
    'Oracle AI Art Demo — Community Showcase',
    'app_demo',
    'Public demonstration of the Oracle interactive experience. Community members engaged with AI-generated contemplative responses at a community gathering. Live demo validated the interaction concept.',
    'June 2024',
    array['AI art', 'interactive experience', 'culture'],
    'Key proof item for Burning Man Project arts grant — shows publicly demonstrated interactive art with community participation.',
    true
  ),
  (
    (select id from projects where slug = 'bm-packing' limit 1),
    'Burning Man Packing List — Published Resource',
    'document',
    'A comprehensive, community-tested preparation guide published and distributed to participants. Covers safety, community norms, leave no trace principles, and practical preparation.',
    null,
    array['community utility', 'documentation', 'participant support'],
    'Demonstrates ability to produce and distribute community utility resources — useful for general organizational capacity proof.',
    true
  ),
  (
    null,
    'Playa AI Workshop Series (2023–2024)',
    'workshop',
    'A series of community workshops where participants collaborated to build technology experiments, tools, and prototypes rooted in community values. Led to multiple project launches.',
    '2023–2024',
    array['community', 'learning', 'project incubation'],
    'Strong proof of community engagement capacity — relevant for Mozilla Foundation, Wellspring, and Knight Foundation applications.',
    true
  ),
  (
    (select id from projects where slug = 'connect-app' limit 1),
    'Connect App — Session Protocol Documentation',
    'document',
    'Detailed documentation of the guided connection session protocol, including question frameworks, session structure, facilitator notes, and design rationale.',
    null,
    array['methodology', 'documentation', 'design'],
    'Internal methodology documentation — attach to grant applications requiring proof of a structured program model (MIT Solve, Wellspring).',
    false
  ),
  (
    (select id from projects where slug = 'ikigai' limit 1),
    'Ikigai Discovery Workshop',
    'workshop',
    'A facilitated group workshop walking participants through the Ikigai framework for discovering purpose and community contribution. Tested the core reflective methodology.',
    'March 2024',
    array['purpose', 'wellbeing', 'workshop'],
    'Validates the Ikigai app methodology with real participants — relevant to Knight Foundation civic tech and purpose-driven wellbeing grants.',
    true
  ),
  (
    null,
    '12+ Community Events Hosted',
    'metric',
    'Over a dozen community events, workshops, and gatherings hosted across 2023 and 2024, bringing together technologists, artists, and community builders.',
    '2023–2024',
    array['impact', 'community', 'scale'],
    'High-impact metric for all applications — demonstrates consistent community engagement and organizational momentum over multiple years.',
    true
  ),
  (
    (select id from projects where slug = 'biohack-burn' limit 1),
    'Biohack Your Burn — Published Guide',
    'document',
    'A written guide published from the workshop, covering evidence-based approaches to physical and mental wellbeing at large-scale participatory events.',
    null,
    array['wellness', 'documentation', 'community education'],
    'Shows ability to translate workshop delivery into reusable public resources — useful for capacity documentation in NEA and community grants.',
    true
  )
on conflict do nothing;
