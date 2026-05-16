-- Migration: 004_create_funders_peers
-- Grant OS V0.4 — Supabase-backed funders and peer organizations
-- Run after 001–003

-- ============================================================
-- TABLE: funders
-- ============================================================

create table if not exists funders (
  id                      uuid primary key default gen_random_uuid(),
  legacy_id               text unique,
  name                    text not null,
  slug                    text unique,
  website                 text,
  ein                     text,
  location                text,
  address                 text,
  phone                   text,
  contact_info            text,
  key_people              jsonb,
  assets                  numeric,
  annual_giving           numeric,
  median_grant_amount     numeric,
  giving_areas            text[] not null default '{}',
  openness_to_new_grantees text,
  relationship_status     text,
  past_grantees           text[] not null default '{}',
  open_applications       boolean not null default false,
  notes                   text,
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_funders_slug on funders(slug);
create index if not exists idx_funders_legacy_id on funders(legacy_id);
create index if not exists idx_funders_archived on funders(archived_at);
create index if not exists idx_funders_name on funders(name);

drop trigger if exists funders_set_updated_at on funders;
create trigger funders_set_updated_at
  before update on funders
  for each row execute procedure set_updated_at();

-- ============================================================
-- TABLE: peer_organizations
-- ============================================================

create table if not exists peer_organizations (
  id                    uuid primary key default gen_random_uuid(),
  legacy_id             text unique,
  name                  text not null,
  slug                  text unique,
  website               text,
  ein                   text,
  location              text,
  address               text,
  description           text,
  assets                numeric,
  annual_revenue        numeric,
  focus_areas           text[] not null default '{}',
  relevance             text,
  key_people            jsonb,
  saved_opportunities   jsonb,
  notes                 text,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_peer_orgs_slug on peer_organizations(slug);
create index if not exists idx_peer_orgs_legacy_id on peer_organizations(legacy_id);
create index if not exists idx_peer_orgs_archived on peer_organizations(archived_at);

drop trigger if exists peer_organizations_set_updated_at on peer_organizations;
create trigger peer_organizations_set_updated_at
  before update on peer_organizations
  for each row execute procedure set_updated_at();

-- ============================================================
-- TABLE: peer_funding_records
-- ============================================================

create table if not exists peer_funding_records (
  id                    uuid primary key default gen_random_uuid(),
  peer_organization_id  uuid not null references peer_organizations(id) on delete cascade,
  funder_id             uuid references funders(id) on delete set null,
  funder_name           text,
  year                  integer,
  amount                numeric,
  source_url            text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_peer_funding_peer on peer_funding_records(peer_organization_id);
create index if not exists idx_peer_funding_funder on peer_funding_records(funder_id);
create index if not exists idx_peer_funding_year on peer_funding_records(year);

drop trigger if exists peer_funding_records_set_updated_at on peer_funding_records;
create trigger peer_funding_records_set_updated_at
  before update on peer_funding_records
  for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- ⚠️  DEVELOPMENT / DEMO POLICIES — REPLACE BEFORE PRODUCTION ⚠️
--
-- ============================================================

alter table funders enable row level security;
alter table peer_organizations enable row level security;
alter table peer_funding_records enable row level security;

create policy "demo_anon_select_funders" on funders for select using (true);
create policy "demo_anon_insert_funders" on funders for insert with check (true);
create policy "demo_anon_update_funders" on funders for update using (true);
create policy "demo_anon_delete_funders" on funders for delete using (true);

create policy "demo_anon_select_peer_orgs" on peer_organizations for select using (true);
create policy "demo_anon_insert_peer_orgs" on peer_organizations for insert with check (true);
create policy "demo_anon_update_peer_orgs" on peer_organizations for update using (true);
create policy "demo_anon_delete_peer_orgs" on peer_organizations for delete using (true);

create policy "demo_anon_select_peer_funding" on peer_funding_records for select using (true);
create policy "demo_anon_insert_peer_funding" on peer_funding_records for insert with check (true);
create policy "demo_anon_update_peer_funding" on peer_funding_records for update using (true);
create policy "demo_anon_delete_peer_funding" on peer_funding_records for delete using (true);

-- ============================================================
-- SEED: funders (legacy_id f1–f9)
-- ============================================================

insert into funders (
  id, legacy_id, name, website, ein, location,
  annual_giving, median_grant_amount, giving_areas,
  open_applications, relationship_status, past_grantees, key_people, notes
) values
  (
    '22222222-2222-4222-8222-222222220001', 'f1', 'MIT Solve',
    'https://solve.mit.edu', null, 'Cambridge, MA',
    2000000, 75000,
    array['Community Technology', 'Social Innovation', 'Global Health', 'Climate'],
    true, 'Researching',
    array['GiveDirectly', 'Nori Carbon', 'Healtheon'],
    null,
    'Open challenge model. Strong emphasis on scalable technology for underserved communities.'
  ),
  (
    '22222222-2222-4222-8222-222222220002', 'f2', 'Mozilla Foundation',
    'https://foundation.mozilla.org', '20-0097189', 'Mountain View, CA',
    15000000, 35000,
    array['Humane Technology', 'Privacy', 'Open Web', 'Digital Rights'],
    true, 'Researching',
    array['Electronic Frontier Foundation', 'Access Now', 'The Markup'],
    '[{"name":"Bridget Bauer","title":"Program Officer, Technology & Society","email":"grants@mozillafoundation.org","role":"primary"}]'::jsonb,
    'Awards grants to orgs building ethical, user-respecting technology. Strong value alignment.'
  ),
  (
    '22222222-2222-4222-8222-222222220003', 'f3', 'Knight Foundation',
    'https://knightfoundation.org', '65-0464177', 'Miami, FL',
    80000000, 125000,
    array['Journalism', 'Civic Technology', 'Community Engagement', 'Arts'],
    false, 'Researching',
    array['Code for America', 'Wikimedia Foundation', 'ProPublica'],
    '[{"name":"Sam Gill","title":"VP, Community & National Initiatives","email":"grants@knightfoundation.org","role":"primary"}]'::jsonb,
    'Large foundation. Must identify program officer contact. Civic tech angle most relevant.'
  ),
  (
    '22222222-2222-4222-8222-222222220004', 'f4', 'Wellspring Foundation',
    'https://wellspringfoundation.org', null, 'San Francisco, CA',
    1500000, 12500,
    array['Loneliness', 'Social Health', 'Mental Health', 'Community'],
    true, 'In Conversation',
    '{}',
    '[{"name":"Sarah Chen","title":"Program Officer","email":"sarah.chen@wellspringfoundation.org","role":"primary"}]'::jsonb,
    'Program officer Sarah Chen is aware of our work. Warm intro via network connection.'
  ),
  (
    '22222222-2222-4222-8222-222222220005', 'f5', 'Robert Wood Johnson Foundation',
    'https://rwjf.org', '22-1807327', 'Princeton, NJ',
    600000000, 250000,
    array['Health Equity', 'Public Health', 'Mental Health', 'Social Determinants'],
    false, 'None',
    '{}',
    null,
    'Major funder. Need 501c3 status or fiscal sponsor to apply.'
  ),
  (
    '22222222-2222-4222-8222-222222220006', 'f6', 'Burning Man Project',
    'https://burningman.org', '74-3177354', 'San Francisco, CA',
    500000, 5000,
    array['Arts', 'Community Innovation', 'Participatory Culture'],
    true, 'Active Relationship',
    array['Multiple community art projects'],
    '[{"name":"Marian Goodell","title":"Chief Executive Officer","email":"grants@burningman.org","role":"primary"}]'::jsonb,
    'Strong community relationship. Multiple team members deeply embedded in Burning Man culture.'
  ),
  (
    '22222222-2222-4222-8222-222222220007', 'f7', 'National Endowment for the Arts',
    'https://arts.gov', '52-0858440', 'Washington, DC',
    180000000, 25000,
    array['Arts', 'Technology & Arts', 'Community Arts', 'Cultural Preservation'],
    true, 'Researching',
    '{}',
    null,
    null
  ),
  (
    '22222222-2222-4222-8222-222222220008', 'f8', 'MacArthur Foundation',
    'https://macfound.org', '23-7093598', 'Chicago, IL',
    260000000, 500000,
    array['Social Innovation', 'Technology', 'Equity', 'Climate', 'Criminal Justice'],
    false, 'None',
    '{}',
    null,
    'Primarily by invitation. Long-term aspiration. Would need significant organizational growth.'
  ),
  (
    '22222222-2222-4222-8222-222222220009', 'f9', 'U.S. Department of State',
    'https://state.gov', null, 'Washington, DC',
    500000000, 100000,
    array['Democracy', 'Civic Technology', 'Digital Rights', 'International Development'],
    false, 'None',
    '{}',
    null,
    'Missed deadline on this cycle. Complex application process. Monitor for future cycles.'
  )
on conflict (id) do nothing;

update funders set assets = 2500000000 where legacy_id = 'f3';
update funders set assets = 12000000000 where legacy_id = 'f5';
update funders set assets = 7500000000 where legacy_id = 'f8';

-- ============================================================
-- SEED: peer_organizations (legacy_id po1–po5)
-- ============================================================

insert into peer_organizations (
  id, legacy_id, name, website, ein, location, description,
  focus_areas, relevance, key_people, saved_opportunities, notes
) values
  (
    '33333333-3333-4333-8333-333333330001', 'po1', 'Touchy-Feely Tech',
    'https://touchyfeely.tech', '87-1234501', 'San Francisco, CA',
    'A nonprofit building humane technology products focused on authentic human connection and reducing social isolation.',
    array['Humane Technology', 'Social Connection', 'Community Wellbeing'],
    'Direct peer in humane technology space. Has relationships with Mozilla and Wellspring.',
    '[{"name":"Amber Rose","title":"Executive Director","email":"amber@touchyfeely.tech","role":"primary"}]'::jsonb,
    '[{"title":"Humane Tech Small Grants Program","funderName":"Center for Humane Technology","deadline":"2026-07-15","relevance":"Direct mission alignment — they fund smaller orgs in this space."}]'::jsonb,
    'Very close mission alignment with Connect App. Sharing funder intelligence would be mutually beneficial.'
  ),
  (
    '33333333-3333-4333-8333-333333330002', 'po2', 'Center for Humane Technology',
    'https://humanetech.com', '82-4190453', 'San Francisco, CA',
    'A nonprofit working to reverse the harms of social media and technology through advocacy, policy, and education.',
    array['Humane Technology', 'Digital Wellbeing', 'Advocacy', 'Policy'],
    'Funder intelligence: Mozilla and Knight both fund humane tech organizations.',
    '[{"name":"Tristan Harris","title":"Co-Founder","email":"info@humanetech.com","role":"primary"}]'::jsonb,
    '[{"title":"Knight Civic Tech Challenge","funderName":"Knight Foundation","deadline":"2026-09-01","relevance":"CHT received Knight funding — this validates the channel for humane tech advocacy work."},{"title":"MacArthur 100&Change","funderName":"MacArthur Foundation","deadline":"2027-01-15","relevance":"Long shot but their MacArthur award shows MacArthur is interested in this space at scale."}]'::jsonb,
    'Larger org, but strong funder alignment. Their MacArthur funding shows MacArthur interest in this space.'
  ),
  (
    '33333333-3333-4333-8333-333333330003', 'po3', 'Cosmic Seed',
    'https://cosmicseed.org', '47-2891033', 'Los Angeles, CA',
    'A community-centered organization that uses immersive and participatory experiences to build social capital and community resilience.',
    array['Community Building', 'Participatory Culture', 'Social Capital', 'Arts'],
    'Both funded by Burning Man Project and NEA. Community building parallel to our workshops.',
    '[{"name":"Maya Stardust","title":"Programs Director","email":"maya@cosmicseed.org","role":"primary"}]'::jsonb,
    '[{"title":"NEA Art Works — Community Engagement","funderName":"National Endowment for the Arts","deadline":"2026-08-10","relevance":"Cosmic Seed received NEA funding — validates NEA as a viable funder for community arts/tech."}]'::jsonb,
    'Strong community in Burning Man adjacent culture. Overlapping network.'
  ),
  (
    '33333333-3333-4333-8333-333333330004', 'po4', 'Wellbeing Collective',
    'https://wellbeingcollective.org', '83-0742811', 'Berkeley, CA',
    'A grassroots collective creating programs and tools to address social isolation and loneliness, particularly for young adults.',
    array['Loneliness', 'Mental Health', 'Youth Wellbeing', 'Community'],
    'Critical: validates that RWJF funds social health work from smaller orgs with fiscal sponsors.',
    '[{"name":"Jordan Park","title":"Co-Director","email":"jordan@wellbeingcollective.org","role":"primary"}]'::jsonb,
    '[{"title":"RWJF Health Equity Grant","funderName":"Robert Wood Johnson Foundation","deadline":"2026-10-01","relevance":"Their RWJF award confirms RWJF will fund orgs at our stage if we have a fiscal sponsor."}]'::jsonb,
    'Has received both Wellspring and RWJF funding. Proof that RWJF funds this type of work.'
  ),
  (
    '33333333-3333-4333-8333-333333330005', 'po5', 'Purpose Lab',
    'https://purposelab.org', '46-5318290', 'Portland, OR',
    'A reflective practice organization helping individuals and communities discover purpose through structured workshop methodologies.',
    array['Purpose', 'Self-Discovery', 'Wellbeing', 'Education'],
    'Validates Knight Foundation and Wellspring as funders for purpose/wellbeing work.',
    '[{"name":"Devon Hazel","title":"Founder & Director","email":"devon@purposelab.org","role":"primary"}]'::jsonb,
    '[{"title":"Knight Community Information Challenge","funderName":"Knight Foundation","deadline":"2026-11-15","relevance":"They received Knight funding for purpose/civic work — same lane as our Ikigai App."},{"title":"Wellspring Social Health Grant","funderName":"Wellspring Foundation","deadline":"2026-06-30","relevance":"Purpose Lab + Wellspring = validated path for purpose-driven wellbeing work."}]'::jsonb,
    'Strong parallel to Ikigai App. Knight Foundation funded their civic engagement angle.'
  )
on conflict (id) do nothing;

-- ============================================================
-- SEED: peer_funding_records
-- ============================================================

insert into peer_funding_records (
  id, peer_organization_id, funder_id, funder_name, year, amount, notes
) values
  (
    '44444444-4444-4444-8444-444444440001',
    '33333333-3333-4333-8333-333333330001',
    '22222222-2222-4222-8222-222222220002',
    'Mozilla Foundation', 2023, 40000, 'Humane tech grant'
  ),
  (
    '44444444-4444-4444-8444-444444440002',
    '33333333-3333-4333-8333-333333330001',
    '22222222-2222-4222-8222-222222220004',
    'Wellspring Foundation', 2024, 15000, null
  ),
  (
    '44444444-4444-4444-8444-444444440003',
    '33333333-3333-4333-8333-333333330002',
    '22222222-2222-4222-8222-222222220003',
    'Knight Foundation', 2022, 500000, null
  ),
  (
    '44444444-4444-4444-8444-444444440004',
    '33333333-3333-4333-8333-333333330002',
    '22222222-2222-4222-8222-222222220002',
    'Mozilla Foundation', 2023, 75000, null
  ),
  (
    '44444444-4444-4444-8444-444444440005',
    '33333333-3333-4333-8333-333333330002',
    '22222222-2222-4222-8222-222222220008',
    'MacArthur Foundation', 2023, 1200000, null
  ),
  (
    '44444444-4444-4444-8444-444444440006',
    '33333333-3333-4333-8333-333333330003',
    '22222222-2222-4222-8222-222222220006',
    'Burning Man Project', 2024, 8000, null
  ),
  (
    '44444444-4444-4444-8444-444444440007',
    '33333333-3333-4333-8333-333333330003',
    '22222222-2222-4222-8222-222222220007',
    'National Endowment for the Arts', 2023, 20000, null
  ),
  (
    '44444444-4444-4444-8444-444444440008',
    '33333333-3333-4333-8333-333333330004',
    '22222222-2222-4222-8222-222222220004',
    'Wellspring Foundation', 2023, 20000, null
  ),
  (
    '44444444-4444-4444-8444-444444440009',
    '33333333-3333-4333-8333-333333330004',
    '22222222-2222-4222-8222-222222220005',
    'Robert Wood Johnson Foundation', 2024, 150000, 'Health equity initiative'
  ),
  (
    '44444444-4444-4444-8444-444444440010',
    '33333333-3333-4333-8333-333333330005',
    '22222222-2222-4222-8222-222222220003',
    'Knight Foundation', 2023, 75000, null
  ),
  (
    '44444444-4444-4444-8444-444444440011',
    '33333333-3333-4333-8333-333333330005',
    '22222222-2222-4222-8222-222222220004',
    'Wellspring Foundation', 2023, 18000, null
  )
on conflict (id) do nothing;
