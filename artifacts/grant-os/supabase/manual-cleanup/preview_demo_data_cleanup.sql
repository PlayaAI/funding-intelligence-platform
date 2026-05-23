-- Manual preview only. Do not delete anything from this file.
-- Purpose: identify likely legacy/demo/seed records for human review.

select 'projects' as table_name, id::text, name as label, slug as secondary_label, created_at
from projects
where slug in ('connect-app','ikigai','bm-packing','biohack-burn','oracle','relationship-tool')
   or name ilike any(array['%Connect App%','%Ikigai%','%Burning Man%','%Biohack%','%Oracle Art%','%Relationship Support%']);

select 'grants' as table_name, id::text, title as label, coalesce(funder_name, related_project_slug) as secondary_label, created_at
from grants
where title ilike any(array['%Wellspring%','%Mozilla Foundation%','%Knight Foundation%','%Burning Man%','%State Dept%','%Connect App%','%Ikigai%','%Oracle Art%'])
   or funder_name ilike any(array['%Wellspring%','%Mozilla Foundation%','%Knight Foundation%','%Burning Man%']);

select 'tasks' as table_name, id::text, title as label, status as secondary_label, created_at
from tasks
where title ilike any(array['%Wellspring%','%Connect App%','%Aaron Coombs%','%MIT Solve%','%Knight Foundation%','%Mozilla Foundation%','%Ikigai%','%Burning Man%'])
   or description ilike any(array['%Wellspring%','%Connect App%','%Aaron Coombs%','%MIT Solve%','%Knight Foundation%','%Mozilla Foundation%','%Ikigai%','%Burning Man%'])
   or owner_name ilike any(array['%Aaron Coombs%']);

select 'proof_items' as table_name, id::text, title as label, type as secondary_label, created_at
from proof_items
where title ilike any(array['%Connect App%','%Burning Man%','%Biohack%','%Oracle%','%Ikigai%','%Wellspring%','%Knight Foundation%','%Mozilla Foundation%'])
   or description ilike any(array['%Burning Man%','%Wellspring%','%Knight Foundation%','%Mozilla Foundation%']);

select 'applications' as table_name, id::text, title as label, status as secondary_label, created_at
from applications
where title ilike any(array['%Wellspring%','%Connect App%','%Burning Man%','%Oracle%','%MIT Solve%'])
   or owner_name ilike any(array['%Aaron Coombs%'])
   or notes ilike any(array['%Wellspring%','%Connect App%','%Burning Man%']);

select 'peer_organizations' as table_name, id::text, name as label, slug as secondary_label, created_at
from peer_organizations
where name ilike any(array['%Humane Technology%','%Purpose Lab%','%Burning Man%','%Wellspring%','%Mozilla%','%Knight%','%Connect App%','%Ikigai%'])
   or notes ilike any(array['%Connect App%','%Ikigai%','%Wellspring%','%Mozilla%','%Knight%']);

select 'documents' as table_name, id::text, title as label, document_type as secondary_label, created_at
from documents
where title ilike any(array['%Connect App%','%Wellspring%','%Biohack%','%Oracle Art%','%Burning Man%'])
   or file_name ilike any(array['%Connect App%','%Wellspring%','%Biohack%','%Oracle%','%Burning Man%'])
   or source_url ilike any(array['%connect%','%wellspring%','%biohack%','%burningman%','%oracle%']);

select 'agent_notes' as table_name, id::text, title as label, note_type as secondary_label, created_at
from agent_notes
where title ilike any(array['%Connect App%','%Wellspring%','%Biohack%','%Oracle%','%Burning Man%','%Ikigai%'])
   or content ilike any(array['%Aaron Coombs%','%Connect App%','%Wellspring%','%Biohack%','%Oracle%','%Burning Man%','%Ikigai%']);

select 'agent_reports' as table_name, id::text, title as label, report_type as secondary_label, created_at
from agent_reports
where title ilike any(array['%Connect App%','%Wellspring%','%Biohack%','%Oracle%','%Burning Man%','%Ikigai%'])
   or content ilike any(array['%Aaron Coombs%','%Connect App%','%Wellspring%','%Biohack%','%Oracle%','%Burning Man%','%Ikigai%']);
