# Grant OS Live QA Plan

Scope: safe production/staging checks only. Do **not** create, update, archive, delete, or import real records without approval.

## Non-destructive checks completed locally

- Public route HTTP smoke: `/`, `/projects`, `/projects/connect-app`, `/proof`, `/workshops`, `/team`, `/contact`
- Dashboard route HTTP smoke: `/dashboard`, `/dashboard/projects`, `/dashboard/grants`, `/dashboard/funders`, `/dashboard/applications`, `/dashboard/tasks`, `/dashboard/documents`, `/dashboard/peers`, `/dashboard/reports`, `/dashboard/tracker`, `/dashboard/calendar`, `/dashboard/financials`, `/dashboard/settings`
- TypeScript typecheck
- Production build
- In-memory simulation suite; no real Supabase writes

## Staging/live read-only QA checklist

1. Open public pages in an incognito browser.
   - Expected: public pages render without dashboard/private record leakage.
   - Verify proof cards do not expose private file URLs or signed storage URLs.
2. Open `/login` and sign in with a test account.
   - Expected: dashboard loads after auth.
3. Read-only dashboard navigation.
   - Open list pages only: projects, grants, funders, applications, tasks, documents, peers, reports.
   - Expected: pages load, filters/sorting work, no unexpected error banners.
4. Detail route read-only spot checks.
   - Open existing staging records only.
   - Expected: details render; long URLs are truncated visually; source/open links use safe targets.
5. Export-only checks.
   - Export application packet JSON from a staging/test application.
   - Export proposal markdown from a staging/test application.
   - Expected: browser downloads file; app logs activity if user has permission.
6. Security/RLS read-only audit.
   - Run `manual-security/rls_public_access_audit.sql` in Supabase SQL editor.
   - Confirm no demo policies or broad anon/private-table policies remain.
7. Data cleanup previews.
   - Run `manual-cleanup/preview_duplicate_documents.sql`.
   - Run `manual-cleanup/preview_bad_import_values.sql`.
   - Expected: SELECT-only result sets; no mutation.

## Checks requiring explicit approval before execution

- Applying migration `016_grant_shortlist_items.sql`
- Creating QA application/grant/task/document records
- Archiving/deleting duplicate records
- Importing fresh Instrumentl data
- Recalibrating grant matches
- Editing production policies or storage bucket policies

## Recommended QA records if mutation is approved later

Use obvious names and archive afterward:

- Project: `QA DO NOT USE - Grant OS Smoke Project`
- Grant: `QA DO NOT USE - Smoke Grant`
- Application: `QA DO NOT USE - Smoke Application`
- Task: `QA DO NOT USE - Smoke Task`
