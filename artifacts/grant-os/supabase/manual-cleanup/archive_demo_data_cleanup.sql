-- Manual cleanup template. Review preview_demo_data_cleanup.sql output first.
-- This file is intentionally commented out and should not be run as-is.
-- Prefer archive/status changes over deletes.

-- begin;

-- Example: archive clearly identified legacy projects.
-- update projects
-- set archived_at = now(), updated_at = now()
-- where slug in ('ikigai','bm-packing','biohack-burn','oracle','relationship-tool')
--   and archived_at is null;

-- Example: archive old seed tasks.
-- update tasks
-- set archived_at = now(), updated_at = now()
-- where archived_at is null
--   and (
--     title ilike any(array['%Wellspring%','%Connect App%','%Aaron Coombs%','%MIT Solve%'])
--     or owner_name ilike '%Aaron Coombs%'
--   );

-- Example: archive old proof items after confirming they are not part of the public proof record.
-- update proof_items
-- set archived_at = now(), updated_at = now()
-- where archived_at is null
--   and public_visibility = false
--   and title ilike any(array['%Connect App%','%Burning Man%','%Biohack%','%Oracle%','%Ikigai%']);

-- Example: archive legacy application workspaces.
-- update applications
-- set archived_at = now(), updated_at = now(), status = 'Archived'
-- where archived_at is null
--   and title ilike any(array['%Wellspring%','%Burning Man%','%MIT Solve%']);

-- Example: archive legacy documents only after confirming they are duplicates.
-- update documents
-- set archived_at = now(), updated_at = now()
-- where archived_at is null
--   and title ilike any(array['%Connect App%','%Wellspring%','%Biohack%','%Oracle Art%']);

-- rollback;
-- Replace rollback with commit only after manual review.
