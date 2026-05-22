-- Migration: 013_enrich_imported_project_profiles
-- Adds strategic matching context to the five imported Instrumentl project shells.
-- Safe behavior: only projects with an empty shell summary are touched, and
-- non-empty user-edited fields are preserved.

with profile_updates(slug, summary, problem_statement, solution, target_audience, geography, technology, impact, grant_relevance, reusable_grant_language, category, stage) as (
  values
    (
      'tech-for-human-flourish',
      'Playa AI Tech for Human Flourish focuses on responsible AI and human-centered technology that supports human flourishing, social wellbeing, belonging, digital wellbeing, future of work, workplace belonging, and learning communities.',
      'Loneliness, fragmented digital life, and weak social support make it harder for people to build durable belonging at work, in learning communities, and in everyday civic life.',
      'The Playa AI Connection Suite / Connect Protocol uses responsible AI, guided conversation, follow-up support, and relationship continuity to help people create deeper first-time human connections and sustain meaningful relationships over time.',
      'Communities, workplaces, learning communities, builders of responsible technology, and people seeking stronger belonging and social wellbeing.',
      'United States, North America, and global communities where responsible AI and human flourishing work is eligible.',
      'Responsible AI, relational AI, human-centered AI, guided conversation systems, digital wellbeing tools, future-of-work technology.',
      'Reduced loneliness, stronger belonging, improved workplace belonging, more resilient learning communities, and healthier human connection infrastructure.',
      'Strong fit for responsible AI, human flourishing, social wellbeing, belonging, digital wellbeing, future of work, workplace belonging, and learning-community opportunities.',
      'Playa AI builds public-benefit, human-centered AI tools that strengthen human connection, belonging, social trust, digital wellbeing, and relationship continuity.',
      'Responsible AI / Human Flourishing',
      'Researching'
    ),
    (
      'foundation',
      'Playa AI Foundation frames the Connection Suite / Connect Protocol as public-benefit technology and community infrastructure for social health, loneliness reduction, human connection, responsible relational AI, and nonprofit or fiscal-sponsor readiness.',
      'Communities need practical infrastructure for loneliness reduction, social health, belonging, and trustworthy human connection, but early-stage public-benefit technology often lacks nonprofit-ready evidence and reusable application materials.',
      'The project develops responsible relational AI, guided conversation, community programs, proof materials, and fiscal-sponsor-ready grant language for human connection infrastructure.',
      'Nonprofits, fiscally sponsored projects, community programs, funders of social health, and public-benefit technology partners.',
      'United States, North America, and global communities where nonprofit, public-benefit, or fiscally sponsored technology work is eligible.',
      'Public-benefit technology, responsible relational AI, community infrastructure, human connection tools, reusable grant systems.',
      'Improved social health, reduced loneliness, stronger community wellbeing, clearer eligibility readiness, and fundable public-benefit technology infrastructure.',
      'Strong fit for public-benefit technology, social health, loneliness, human connection infrastructure, community programs, responsible relational AI, and nonprofit/fiscal-sponsor readiness grants.',
      'Playa AI can be positioned as a fiscally sponsored or nonprofit-ready public-benefit technology initiative focused on loneliness, belonging, social trust, and community wellbeing.',
      'Public-Benefit Technology',
      'Researching'
    ),
    (
      'art-science',
      'Playa AI Art / Science explores creative technology, participatory experiences, social connection, human-centered AI, community installations, social cohesion, and art/science public engagement.',
      'Many arts and science engagement formats are inspiring but do not reliably create sustained human connection, belonging, or relationship continuity after the experience ends.',
      'The project uses human-centered AI, participatory installations, guided social experiences, and follow-up support to turn creative technology encounters into durable connection and community learning.',
      'Art/science audiences, public-engagement programs, community events, participatory installation hosts, and creative technology funders.',
      'United States, North America, and global public-engagement contexts where creative technology or art/science programs are eligible.',
      'Creative technology, participatory experiences, human-centered AI, responsible AI, community installations, public engagement systems.',
      'Stronger social connection, public engagement with responsible AI, social cohesion, and measurable community learning from participatory art/science experiences.',
      'Strongest arts/culture fit when opportunities support participatory public engagement, creative technology, community installations, social connection, or art/science learning.',
      'Playa AI Art / Science should be framed around participatory creative technology, human-centered AI, community installations, social cohesion, and public engagement rather than generic exhibition or curatorial work.',
      'Art / Science Public Engagement',
      'Researching'
    ),
    (
      'democracy-2-0-initiatives',
      'Playa AI Democracy 2.0 Initiatives focuses on civic trust, pluralism, social cohesion, community dialogue, polarization reduction, democratic culture, and responsible AI for civic life.',
      'Social fragmentation, polarization, low civic trust, and weak community dialogue make democratic culture harder to sustain.',
      'The project adapts the Connection Suite / Connect Protocol for civic trust, pluralism, community dialogue, and responsible AI-supported relationship continuity across difference.',
      'Civic communities, pluralism initiatives, democracy funders, dialogue programs, community organizers, and social-cohesion partners.',
      'United States, North America, and global civic contexts where democracy, pluralism, and social-cohesion work is eligible.',
      'Responsible AI for civic life, dialogue tools, social trust infrastructure, human-centered AI, community conversation systems.',
      'Higher civic trust, stronger pluralism, reduced polarization, improved community dialogue, and durable relationships across difference.',
      'Strong fit for civic trust, pluralism, social cohesion, community dialogue, polarization reduction, democratic culture, and responsible AI for civic life.',
      'Playa AI can be described as responsible AI community infrastructure for civic trust, dialogue across difference, pluralism, social cohesion, and democratic culture.',
      'Civic Trust / Democracy',
      'Researching'
    ),
    (
      'decommodified-dataset',
      'Playa AI Decommodified Dataset focuses on open, public-interest data and noncommercial social connection infrastructure: a decommodified social graph, community intelligence, responsible AI research, and public-benefit data for human connection.',
      'Dominant social data systems often commodify attention and relationships, making it difficult to build noncommercial technology for belonging, trust, and community wellbeing.',
      'The project develops public-interest data, a decommodified social graph, community intelligence methods, and responsible AI research infrastructure for human connection and relationship continuity.',
      'Responsible AI researchers, public-benefit technology builders, social-impact data funders, community infrastructure partners, and noncommercial technology initiatives.',
      'United States, North America, and global contexts where public-interest data, research, and public-benefit technology are eligible.',
      'Responsible AI research, public-benefit data, decommodified social graph, community intelligence, noncommercial social connection infrastructure.',
      'A stronger evidence base and public-benefit data layer for loneliness reduction, belonging, human connection, social trust, and responsible relational AI.',
      'Strong fit for open/public-interest dataset, decommodified social graph, noncommercial social connection infrastructure, community intelligence, responsible AI research, and public-benefit data grants.',
      'Playa AI can be framed as public-benefit data and responsible AI research infrastructure for human connection, belonging, social trust, and noncommercial relationship continuity.',
      'Public-Interest Data / Responsible AI',
      'Researching'
    )
)
update projects p
set
  summary = case when p.summary is null or btrim(p.summary) = '' or p.summary = 'Imported Instrumentl dataset project shell.' then u.summary else p.summary end,
  problem_statement = case when p.problem_statement is null or btrim(p.problem_statement) = '' then u.problem_statement else p.problem_statement end,
  solution = case when p.solution is null or btrim(p.solution) = '' then u.solution else p.solution end,
  target_audience = case when p.target_audience is null or btrim(p.target_audience) = '' then u.target_audience else p.target_audience end,
  geography = case when p.geography is null or btrim(p.geography) = '' then u.geography else p.geography end,
  technology = case when p.technology is null or btrim(p.technology) = '' then u.technology else p.technology end,
  impact = case when p.impact is null or btrim(p.impact) = '' then u.impact else p.impact end,
  grant_relevance = case when p.grant_relevance is null or btrim(p.grant_relevance) = '' then u.grant_relevance else p.grant_relevance end,
  reusable_grant_language = case when p.reusable_grant_language is null or btrim(p.reusable_grant_language) = '' then u.reusable_grant_language else p.reusable_grant_language end,
  category = case when p.category is null or btrim(p.category) = '' then u.category else p.category end,
  stage = case when p.stage is null or btrim(p.stage) = '' then u.stage else p.stage end,
  updated_at = now()
from profile_updates u
where p.slug = u.slug
  and (
    p.summary is null
    or btrim(p.summary) = ''
    or p.summary = 'Imported Instrumentl dataset project shell.'
  );
