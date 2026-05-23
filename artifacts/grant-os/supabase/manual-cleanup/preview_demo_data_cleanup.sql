-- V1.2.2 Data Cleanup Preview
-- Safe preview only. This file only SELECTs possible legacy/demo/seed records.
-- Do not use this output for automatic deletion. Review every row manually.
--
-- Output columns:
--   table_name
--   id
--   title_or_name
--   reason_detected
--   recommended_default_action: keep | archive_candidate | delete_candidate | review
--   notes

with suspicious_patterns as (
  select array[
    '%Aaron Coombs%',
    '%Wellspring%',
    '%Mozilla Foundation%',
    '%Knight Foundation%',
    '%Connect App%',
    '%Ikigai%',
    '%Burning Man Packing List%',
    '%Biohack Your Burn%',
    '%Oracle Art Demo%',
    '%Relationship Support Tool%',
    '%State Dept%',
    '%Democracy & Civic Technology%',
    '%demo%',
    '%seed%',
    '%mock%',
    '%sample%',
    '%test%'
  ]::text[] as patterns
),
seed_project_slugs as (
  select array[
    'connect-app',
    'ikigai',
    'bm-packing',
    'biohack-burn',
    'oracle',
    'relationship-tool'
  ]::text[] as slugs
)

select *
from (
  select
    'projects' as table_name,
    p.id::text as id,
    p.name as title_or_name,
    concat_ws(
      '; ',
      case when p.slug = any(sps.slugs) then 'slug matches original seed project list' end,
      case when p.name ilike any(sp.patterns) then 'name matches suspicious keyword' end,
      case when p.summary ilike any(sp.patterns) then 'summary matches suspicious keyword' end,
      case when p.grant_relevance ilike any(sp.patterns) then 'grant_relevance matches suspicious keyword' end
    ) as reason_detected,
    case
      when p.slug = 'connect-app' and p.public_visibility = true then 'keep'
      when p.public_visibility = true then 'review'
      when p.slug = any(sps.slugs) then 'archive_candidate'
      when p.name ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      else 'review'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Seed project records may now be real public portfolio records.',
      'Confirm public_visibility, linked proof, and dashboard usage before archiving.',
      'slug=' || coalesce(p.slug, '-')
    ) as notes
  from projects p
  cross join suspicious_patterns sp
  cross join seed_project_slugs sps
  where p.slug = any(sps.slugs)
     or p.name ilike any(sp.patterns)
     or p.summary ilike any(sp.patterns)
     or p.grant_relevance ilike any(sp.patterns)

  union all

  select
    'grants' as table_name,
    g.id::text as id,
    g.title as title_or_name,
    concat_ws(
      '; ',
      case when g.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when g.funder_name ilike any(sp.patterns) then 'funder_name matches suspicious keyword' end,
      case when g.related_project_slug = any(sps.slugs) then 'related project slug matches seed project list' end,
      case when g.notes ilike any(sp.patterns) then 'notes match suspicious keyword' end
    ) as reason_detected,
    case
      when g.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      when g.related_project_slug = any(sps.slugs) then 'review'
      else 'review'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Do not archive/delete imported Instrumentl opportunities from this preview alone.',
      'Only archive if confirmed as pre-import seed/mock data.',
      'funder=' || coalesce(g.funder_name, '-'),
      'source_url=' || coalesce(g.source_url, '-')
    ) as notes
  from grants g
  cross join suspicious_patterns sp
  cross join seed_project_slugs sps
  where g.title ilike any(sp.patterns)
     or g.funder_name ilike any(sp.patterns)
     or g.related_project_slug = any(sps.slugs)
     or g.notes ilike any(sp.patterns)

  union all

  select
    'tasks' as table_name,
    t.id::text as id,
    t.title as title_or_name,
    concat_ws(
      '; ',
      case when t.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when t.description ilike any(sp.patterns) then 'description matches suspicious keyword' end,
      case when t.owner_name ilike any(sp.patterns) then 'owner_name matches suspicious keyword' end,
      case when t.notes ilike any(sp.patterns) then 'notes match suspicious keyword' end
    ) as reason_detected,
    case
      when t.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      when t.owner_name ilike '%Aaron Coombs%' then 'archive_candidate'
      else 'review'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Tasks are operational records; archive stale seed tasks rather than delete.',
      'status=' || coalesce(t.status, '-'),
      'owner=' || coalesce(t.owner_name, '-')
    ) as notes
  from tasks t
  cross join suspicious_patterns sp
  where t.title ilike any(sp.patterns)
     or t.description ilike any(sp.patterns)
     or t.owner_name ilike any(sp.patterns)
     or t.notes ilike any(sp.patterns)

  union all

  select
    'proof_items' as table_name,
    pi.id::text as id,
    pi.title as title_or_name,
    concat_ws(
      '; ',
      case when pi.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when pi.description ilike any(sp.patterns) then 'description matches suspicious keyword' end,
      case when pi.grant_relevance ilike any(sp.patterns) then 'grant_relevance matches suspicious keyword' end,
      case when array_to_string(pi.tags, ' ') ilike any(sp.patterns) then 'tags match suspicious keyword' end
    ) as reason_detected,
    case
      when pi.public_visibility = true then 'keep'
      when pi.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      else 'archive_candidate'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Public proof may be intentionally retained on public pages.',
      'Archive non-public duplicates only after confirming they are not useful.',
      'type=' || coalesce(pi.type, '-'),
      'public=' || coalesce(pi.public_visibility::text, '-')
    ) as notes
  from proof_items pi
  cross join suspicious_patterns sp
  where pi.title ilike any(sp.patterns)
     or pi.description ilike any(sp.patterns)
     or pi.grant_relevance ilike any(sp.patterns)
     or array_to_string(pi.tags, ' ') ilike any(sp.patterns)

  union all

  select
    'applications' as table_name,
    a.id::text as id,
    a.title as title_or_name,
    concat_ws(
      '; ',
      case when a.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when a.owner_name ilike any(sp.patterns) then 'owner_name matches suspicious keyword' end,
      case when a.notes ilike any(sp.patterns) then 'notes match suspicious keyword' end
    ) as reason_detected,
    case
      when a.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      when a.owner_name ilike '%Aaron Coombs%' then 'archive_candidate'
      else 'review'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Applications are workspace records; prefer status=Archived plus archived_at.',
      'status=' || coalesce(a.status, '-'),
      'owner=' || coalesce(a.owner_name, '-')
    ) as notes
  from applications a
  cross join suspicious_patterns sp
  where a.title ilike any(sp.patterns)
     or a.owner_name ilike any(sp.patterns)
     or a.notes ilike any(sp.patterns)

  union all

  select
    'peer_organizations' as table_name,
    po.id::text as id,
    po.name as title_or_name,
    concat_ws(
      '; ',
      case when po.name ilike any(sp.patterns) then 'name matches suspicious keyword' end,
      case when po.description ilike any(sp.patterns) then 'description matches suspicious keyword' end,
      case when po.relevance ilike any(sp.patterns) then 'relevance matches suspicious keyword' end,
      case when po.notes ilike any(sp.patterns) then 'notes match suspicious keyword' end,
      case when po.saved_opportunities::text ilike any(sp.patterns) then 'saved_opportunities match suspicious keyword' end
    ) as reason_detected,
    case
      when po.name ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      else 'archive_candidate'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Peer organizations from early migrations appear to be synthetic intelligence examples.',
      'Archive before delete unless confirmed disposable.',
      'slug=' || coalesce(po.slug, '-')
    ) as notes
  from peer_organizations po
  cross join suspicious_patterns sp
  where po.name ilike any(sp.patterns)
     or po.description ilike any(sp.patterns)
     or po.relevance ilike any(sp.patterns)
     or po.notes ilike any(sp.patterns)
     or po.saved_opportunities::text ilike any(sp.patterns)

  union all

  select
    'documents' as table_name,
    d.id::text as id,
    d.title as title_or_name,
    concat_ws(
      '; ',
      case when d.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when d.file_name ilike any(sp.patterns) then 'file_name matches suspicious keyword' end,
      case when d.source_url ilike any(sp.patterns) then 'source_url matches suspicious keyword' end,
      case when d.metadata::text ilike any(sp.patterns) then 'metadata matches suspicious keyword' end
    ) as reason_detected,
    case
      when d.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      else 'review'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Do not touch Instrumentl source documents unless clearly fake/duplicate.',
      'Prefer archive for duplicate/manual seed documents.',
      'type=' || coalesce(d.document_type, '-'),
      'source_url=' || coalesce(d.source_url, '-')
    ) as notes
  from documents d
  cross join suspicious_patterns sp
  where d.title ilike any(sp.patterns)
     or d.file_name ilike any(sp.patterns)
     or d.source_url ilike any(sp.patterns)
     or d.metadata::text ilike any(sp.patterns)

  union all

  select
    'agent_notes' as table_name,
    an.id::text as id,
    an.title as title_or_name,
    concat_ws(
      '; ',
      case when an.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when an.content ilike any(sp.patterns) then 'content matches suspicious keyword' end,
      case when an.structured_data::text ilike any(sp.patterns) then 'structured_data matches suspicious keyword' end
    ) as reason_detected,
    case
      when an.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      else 'archive_candidate'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Agent notes support soft archive.',
      'Archive old seed/import-review notes before considering deletion.',
      'type=' || coalesce(an.note_type, '-')
    ) as notes
  from agent_notes an
  cross join suspicious_patterns sp
  where an.title ilike any(sp.patterns)
     or an.content ilike any(sp.patterns)
     or an.structured_data::text ilike any(sp.patterns)

  union all

  select
    'agent_reports' as table_name,
    ar.id::text as id,
    ar.title as title_or_name,
    concat_ws(
      '; ',
      case when ar.title ilike any(sp.patterns) then 'title matches suspicious keyword' end,
      case when ar.content ilike any(sp.patterns) then 'content matches suspicious keyword' end,
      case when ar.structured_data::text ilike any(sp.patterns) then 'structured_data matches suspicious keyword' end
    ) as reason_detected,
    case
      when ar.title ilike any(array['%demo%','%seed%','%mock%','%sample%','%test%']) then 'delete_candidate'
      else 'archive_candidate'
    end as recommended_default_action,
    concat_ws(
      ' ',
      'Agent reports support soft archive.',
      'Archive stale seed reports before considering deletion.',
      'type=' || coalesce(ar.report_type, '-')
    ) as notes
  from agent_reports ar
  cross join suspicious_patterns sp
  where ar.title ilike any(sp.patterns)
     or ar.content ilike any(sp.patterns)
     or ar.structured_data::text ilike any(sp.patterns)
) suspicious_records
where reason_detected is not null
  and reason_detected <> ''
order by
  case recommended_default_action
    when 'delete_candidate' then 1
    when 'archive_candidate' then 2
    when 'review' then 3
    when 'keep' then 4
    else 5
  end,
  table_name,
  title_or_name;
