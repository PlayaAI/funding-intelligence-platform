# Grant OS Production Readiness Report

Generated: 2026-05-26T19:15:54Z

## Bottom line

Grant OS is materially stronger after this pass, but it is **not ready for production go-live until the live Supabase project is audited and migration 016 is applied in staging first**.

Code/build quality is currently green locally. The remaining blockers are operational/live-environment verification items, not TypeScript build failures.

## What passed

- TypeScript typecheck: passed
- Production build: passed
- Simulation suite: 45 passed, 0 failed, 0 skipped
- HTTP route smoke: 20 public/dashboard routes returned 200 from local Vite server
- `git diff --check`: passed
- Static security scan for hardcoded secrets / dangerous shell/eval patterns: no findings
- Independent code review: passed after fixing shortlist uniqueness/permission issues
- Secret file scan: no `.env*` or `.zip` files found within the configured scan depth

## Changes made in this pass

### Route safety / performance

- Dashboard route components are lazy-loaded with React `lazy`/`Suspense`.
- Vite build now has manual vendor chunks for React, Supabase, Radix, TanStack Query, and other vendor code.
- Initial app chunk reduced from the prior very large single dashboard bundle to smaller route/vendor chunks.

### Proposal workspace

- Application questions now support editing draft and final answers in the dashboard form.
- Application detail shows answered/approved/review counts.
- Application questions display drafted/final answer text inline.
- Added export of proposal markdown from an application detail page.
- Existing application JSON export remains available.

### Saved grants / shortlist / manual discovery

- Added additive migration: `supabase/migrations/016_grant_shortlist_items.sql`.
- Added `grant_shortlist_items` service and React Query hook.
- Grants page now displays a curation status selector.
- Curation writes are permission-gated in UI and RLS.
- Soft-archive uniqueness is handled through active-only partial unique indexes.

### Data cleanup and security support

- Added SELECT-only duplicate document preview:
  - `manual-cleanup/preview_duplicate_documents.sql`
- Added SELECT-only suspicious import value preview:
  - `manual-cleanup/preview_bad_import_values.sql`
- Added SELECT-only RLS/public-access audit:
  - `manual-security/rls_public_access_audit.sql`

### Production hardening docs

- Added `PRODUCTION_CHECKLIST.md`.
- Added `LIVE_QA_PLAN.md`.
- Added package script: `pnpm run validate`.

## Brutal go-live blockers

1. **Live Supabase RLS has not been verified in this run.**
   - Migration files look sane, but production readiness depends on the live database policy state.
   - Run `manual-security/rls_public_access_audit.sql` in Supabase SQL editor before any launch.

2. **Migration 016 is not applied yet.**
   - The shortlist UI handles a missing table gracefully for reads, but curation writes need the migration.
   - Apply it to staging first, then verify, then production.

3. **Storage bucket privacy still needs live verification.**
   - Imported/source documents should not be anon-readable.
   - Public pages must not expose signed URLs or private storage paths.

4. **No real authenticated browser QA was performed here.**
   - Local HTTP smoke verifies route serving, not full browser interactions against the real Supabase project.
   - Use `LIVE_QA_PLAN.md` for staging checks.

5. **Data quality cleanup is preview-only.**
   - Duplicate/suspicious-value SQL scripts intentionally do not mutate data.
   - Do not delete/archive cleanup results until manually reviewed.

## Important warnings

- Vite still emits sourcemap location warnings for some UI component files during build. The build succeeds; this is not currently blocking, but it is noisy.
- Bundle size is improved, but vendor chunks still contain large unavoidable dependencies, especially React/Supabase. Acceptable for now; not final performance optimization.
- The shortlist service currently uses `supabase as any` because the generated DB type file was not regenerated. Typecheck passes, but generated types should be updated after migration application.
- Applying old migrations out of order could briefly create demo policies before `006_auth_roles_rls.sql` drops them. Fresh environments must apply migrations in order.

## Required next actions before production

1. Deploy/apply migrations to staging in order, including `016_grant_shortlist_items.sql`.
2. Run the RLS audit SQL in staging.
3. Verify storage bucket policies in staging.
4. Run live authenticated QA using `LIVE_QA_PLAN.md`.
5. Apply the same migration/policy process to production only after staging passes.
6. Keep destructive cleanup/manual imports disabled until explicitly approved.

## Validation commands used

```bash
npx pnpm@10 --filter @workspace/grant-os run typecheck
npx pnpm@10 --filter @workspace/grant-os run build
npx pnpm@10 --filter @workspace/grant-os run test:simulations
git diff --check
```

## Current readiness verdict

- **Local code quality:** Ready to commit after review.
- **Staging readiness:** Ready for staging migration and QA.
- **Production readiness:** Not yet. Production is blocked on live Supabase RLS/storage verification and staging sign-off.
