-- SELECT-only bad imported value preview for Grant OS.
-- Safe: does not mutate, delete, or archive records.

select
  'funders' as table_name,
  id,
  name as record_title,
  'description' as field_name,
  description as field_value,
  'weak_or_placeholder_description' as issue
from public.funders
where archived_at is null
  and description is not null
  and lower(trim(description)) in ('high', 'medium', 'low', 'n/a', 'na', 'none', 'null', 'unknown')

union all

select
  'grants' as table_name,
  id,
  title as record_title,
  'eligibility' as field_name,
  eligibility as field_value,
  'weak_or_placeholder_eligibility' as issue
from public.grants
where archived_at is null
  and eligibility is not null
  and lower(trim(eligibility)) in ('high', 'medium', 'low', 'n/a', 'na', 'none', 'null', 'unknown')

union all

select
  'grants' as table_name,
  id,
  title as record_title,
  'source_url' as field_name,
  source_url as field_value,
  'missing_or_suspicious_source_url' as issue
from public.grants
where archived_at is null
  and (source_url is null or source_url !~* '^https?://')

union all

select
  'documents' as table_name,
  id,
  title as record_title,
  'source_url' as field_name,
  source_url as field_value,
  'signed_or_very_long_source_url' as issue
from public.documents
where archived_at is null
  and source_url is not null
  and (length(source_url) > 240 or source_url ~* '(X-Amz-Signature|Signature=|Expires=|token=)')

order by table_name, issue, record_title;
