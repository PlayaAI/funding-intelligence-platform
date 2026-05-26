-- SELECT-only duplicate document preview for Grant OS.
-- Safe: does not mutate, delete, or archive records.

with normalized_documents as (
  select
    id,
    title,
    coalesce(nullif(file_path, ''), nullif(file_url, ''), nullif(source_url, ''), nullif(file_name, ''), lower(trim(title))) as duplicate_key,
    document_type,
    related_grant_id,
    related_funder_id,
    related_project_id,
    related_application_id,
    archived_at,
    created_at
  from public.documents
), duplicate_groups as (
  select
    duplicate_key,
    count(*) as duplicate_count,
    array_agg(id order by created_at) as document_ids,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at
  from normalized_documents
  where archived_at is null and duplicate_key is not null
  group by duplicate_key
  having count(*) > 1
)
select
  dg.duplicate_count,
  dg.duplicate_key,
  dg.document_ids,
  dg.first_seen_at,
  dg.last_seen_at,
  jsonb_agg(
    jsonb_build_object(
      'id', nd.id,
      'title', nd.title,
      'document_type', nd.document_type,
      'related_grant_id', nd.related_grant_id,
      'related_funder_id', nd.related_funder_id,
      'created_at', nd.created_at
    ) order by nd.created_at
  ) as documents
from duplicate_groups dg
join normalized_documents nd on nd.duplicate_key = dg.duplicate_key
where nd.archived_at is null
group by dg.duplicate_count, dg.duplicate_key, dg.document_ids, dg.first_seen_at, dg.last_seen_at
order by dg.duplicate_count desc, dg.last_seen_at desc;
