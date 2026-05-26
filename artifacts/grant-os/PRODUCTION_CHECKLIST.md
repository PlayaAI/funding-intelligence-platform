# Grant OS Production Checklist

Last updated: 2026-05-26

## Required environment variables

Frontend-safe only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do **not** expose in frontend/Replit client env:

- Supabase service-role key
- GitHub tokens
- import credentials
- AI provider keys
- any `.env` file contents

## Supabase migrations required

Apply migrations in order from `supabase/migrations/` against staging first, then production after validation.

Current production-relevant migrations include:

- `001_create_projects.sql`
- `002_create_proof_items.sql`
- `003_create_grants.sql`
- `004_create_funders_peers.sql`
- `005_create_applications_tasks.sql`
- `006_auth_roles_rls.sql`
- `007_create_imports.sql`
- `008_create_custom_fields.sql`
- `009_create_agent_layer.sql`
- `010_create_documents.sql`
- `011_create_grant_matches.sql`
- `012_calibrate_grant_matches.sql` — existing calibration only; do not recalibrate in current phase
- `013_enrich_imported_project_profiles.sql`
- `014_public_read_policies.sql`
- `015_peer_intelligence_system.sql`
- `016_grant_shortlist_items.sql`

## Replit artifact notes

- Use the app script: `pnpm --filter @workspace/grant-os run dev`
- Replit artifact mode manages exposed ports.
- Do **not** force port `5173` in Replit config.
- Keep Vite host binding in the script; do not add service-role env vars.

## Public/private data rules

Public anon access may read only:

- `projects` where `public_visibility = true and archived_at is null`
- `proof_items` where `public_visibility = true and archived_at is null`
- static/editorial frontend content

Public anon must not read:

- applications
- application questions/answers
- tasks
- funders/grants dashboards if considered private for the deployment
- peers / peer funding records
- grant matches
- agent notes / reports / activity
- private documents
- imports/raw metadata
- storage objects unless explicitly public-safe

## RLS audit checklist

Run `manual-security/rls_public_access_audit.sql` in Supabase SQL editor and verify:

- no `demo_%` policies remain
- no private tables have anon/public broad `using (true)` policies
- RLS is enabled on private tables
- public policies are narrow and visibility-gated
- authenticated write policies use `can_contribute()` or `can_write()` as appropriate
- destructive/delete policies remain admin or grant-lead only

## Storage bucket checklist

- Buckets containing imported source docs should be private by default.
- Signed URLs should be generated only for authenticated dashboard users.
- Do not expose signed S3/Supabase URLs on public pages.
- Confirm storage policies do not allow anon list/read of private documents.

## Backup/restore notes

Before production migration/import work:

- Export schema and policy snapshot.
- Confirm Supabase PITR/backups are enabled for production.
- Record migration version applied.
- Test restore procedure in staging, not production.

## Validation commands

From repo root:

```bash
npx pnpm@10 --filter @workspace/grant-os run typecheck
npx pnpm@10 --filter @workspace/grant-os run build
npx pnpm@10 --filter @workspace/grant-os run test:simulations
```

Or from `artifacts/grant-os` after install:

```bash
pnpm run validate
```

## Deployment commands

Local/Replit dev:

```bash
pnpm --filter @workspace/grant-os run dev
```

Production build:

```bash
pnpm --filter @workspace/grant-os run build
```

Preview built app:

```bash
pnpm --filter @workspace/grant-os run serve
```

## Rollback notes

- Frontend rollback: redeploy the previous known-good commit.
- Database rollback: prefer forward-fix migrations. Do not drop/alter production data without an approved restore plan.
- If a migration adds a table (for example `grant_shortlist_items`), rollback can leave it unused rather than dropping it.

## Forbidden files/secrets

Do not commit:

- `.env` / `.env.*`
- ZIP/import archives
- `import-data/`
- Supabase service-role keys
- GitHub tokens
- generated exports containing private data

Before push:

```bash
git status --short
git diff --cached --name-only
find . -maxdepth 4 \( -name ".env*" -o -name "*.zip" \) -print
```

## Manual QA routes

Public:

- `/`
- `/projects`
- `/projects/connect-app`
- `/proof`
- `/workshops`
- `/team`
- `/contact`

Dashboard:

- `/dashboard`
- `/dashboard/projects`
- `/dashboard/grants`
- `/dashboard/funders`
- `/dashboard/applications`
- `/dashboard/tasks`
- `/dashboard/documents`
- `/dashboard/peers`
- `/dashboard/reports`
- `/dashboard/tracker`
- `/dashboard/calendar`
- `/dashboard/financials`
- `/dashboard/settings`

Detail routes should be tested using real existing IDs/slugs from staging.

## Known warnings / gaps

- Build may warn about large chunks; dashboard routes are lazy-loaded, but vendor chunks can still be large.
- Matching calibration is intentionally deferred.
- Live workflow mutation QA should use clearly labeled QA records only, then archive/clean them after approval.
- Production readiness depends on verifying the live Supabase policy state, not only migration files.
