-- Migration: 001_create_projects
-- Creates the projects table for Grant OS
-- Run this in your Supabase SQL editor or via the Supabase CLI

-- ============================================================
-- ENUMS (add only if not already present)
-- ============================================================

-- No project-specific enums required in V1

-- ============================================================
-- TABLE: projects
-- ============================================================

create table if not exists projects (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid,
  name                  text not null,
  slug                  text unique not null,
  summary               text,
  problem_statement     text,
  solution              text,
  target_audience       text,
  geography             text,
  stage                 text,
  technology            text,
  impact                text,
  reusable_grant_language text,

  -- UI / display fields (not in original schema spec but required for dashboard parity)
  category              text,
  grant_relevance       text,
  featured              boolean not null default false,

  -- Visibility and lifecycle
  public_visibility     boolean not null default false,
  archived_at           timestamptz,

  -- Timestamps
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_projects_org          on projects(organization_id);
create index if not exists idx_projects_slug         on projects(slug);
create index if not exists idx_projects_archived     on projects(archived_at);
create index if not exists idx_projects_public       on projects(public_visibility);

-- ============================================================
-- UPDATED_AT trigger (keep updated_at in sync automatically)
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (disabled for V1 demo — enable when adding Supabase Auth)
-- ============================================================

-- alter table projects enable row level security;
-- create policy "Allow all for authenticated" on projects
--   for all using (auth.role() = 'authenticated');

-- ============================================================
-- SEED DATA (matches existing mock data so the dashboard looks
--            populated immediately after running this migration)
-- ============================================================

insert into projects
  (name, slug, summary, problem_statement, target_audience, stage, category, grant_relevance, featured, public_visibility)
values
  (
    'Connect App',
    'connect-app',
    'A guided interaction tool that helps people connect more meaningfully — with someone they''re meeting for the first time, or someone they already know. It prompts deeper questions and eventually asks both people to put the phone down.',
    'Most social interactions remain shallow, fragmented, and screen-mediated, even when people are physically present together.',
    'Intentional communities, event participants, workshop attendees, people seeking deeper connection.',
    'MVP / field testing',
    'Human Connection Technology',
    'Social cohesion, loneliness reduction, community building, humane technology',
    true,
    true
  ),
  (
    'Ikigai App',
    'ikigai',
    'A reflective tool guiding people through the Ikigai framework to clarify their purpose, strengths, and meaningful contribution to the community.',
    null,
    null,
    'Prototype',
    'Self-Discovery / Purpose',
    'Human flourishing, education, wellbeing, reflective practice',
    true,
    true
  ),
  (
    'Burning Man Packing List',
    'bm-packing',
    'A practical, community-tested preparation guide helping Burning Man participants show up ready, safe, and community-minded.',
    null,
    null,
    'Live',
    'Community Utility',
    'Community infrastructure, participant support, civic participation',
    true,
    true
  ),
  (
    'Biohack Your Burn',
    'biohack-burn',
    'A workshop and published guide for optimizing wellbeing at large-scale participatory events using evidence-based approaches to sleep, nutrition, heat adaptation, and community care.',
    null,
    null,
    'Published',
    'Wellness / Education',
    'Wellbeing, community education, workshop outputs, public health',
    false,
    false
  ),
  (
    'Oracle Art Demo',
    'oracle',
    'An interactive experience where participants speak with an AI-powered Oracle — blending contemplative tradition with experimental AI interaction design at community events.',
    null,
    null,
    'Demo Complete',
    'AI Art / Interactive Experience',
    'Arts and technology, interactive AI, cultural experimentation, creative community',
    false,
    false
  ),
  (
    'Relationship Support Tool',
    'relationship-tool',
    'A lightweight tool helping people maintain meaningful relationships through gentle reminders, check-ins, and contextual prompts.',
    null,
    null,
    'Early Prototype',
    'Relationship Maintenance',
    'Connection, social support, community continuity, mental health',
    false,
    false
  )
on conflict (slug) do nothing;
