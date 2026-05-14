# Supabase Setup — Grant OS

## Prerequisites

- A Supabase project at https://supabase.com
- Project URL and anon/public key from **Settings → API**

## 1. Environment Variables

Add both secrets to Replit Secrets (Settings → Secrets) or your `.env` file:

| Key | Where to find it |
|-----|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |

> Both variables must be prefixed with `VITE_` for Vite to expose them to the browser.

## 2. Run the Migration

Open your Supabase project, go to **SQL Editor**, and run:

```
supabase/migrations/001_create_projects.sql
```

This creates the `projects` table with all required columns, indexes, an
`updated_at` trigger, and seed data matching the existing mock projects.

### Using Supabase CLI (optional)

```bash
supabase db push
```

## 3. Verify

After running the migration:

1. Open **Table Editor → projects** — you should see 6 seed rows.
2. Open the Grant OS dashboard at `/dashboard/projects` — it should load the
   real projects from the database.

## 4. Row Level Security (V1)

RLS is **disabled** by default in the migration. The dashboard uses the anon
key with no user authentication on the database side yet.

When you add Supabase Auth (Phase 2), uncomment the RLS block in the migration:

```sql
alter table projects enable row level security;
create policy "Allow all for authenticated" on projects
  for all using (auth.role() = 'authenticated');
```

## 5. What is real vs mock data

| Module | Data source |
|--------|-------------|
| Projects | **Supabase** (real) |
| Grants | Mock data (`src/data/grants.ts`) |
| Funders | Mock data (`src/data/funders.ts`) |
| Peer orgs | Mock data (`src/data/peers.ts`) |
| Applications | Mock data (`src/data/applications.ts`) |
| Tasks | Mock data (`src/data/tasks.ts`) |
| Proof items | Mock data (`src/data/proofItems.ts`) |
| Documents | Mock data (`src/data/documents.ts`) |

## 6. CRUD capabilities (Phase 1)

| Action | Available |
|--------|-----------|
| List projects | Yes |
| View project detail | Yes |
| Create project | Yes |
| Edit project | Yes |
| Archive project (soft-delete) | Yes |
| Hard delete project | Yes (from detail page) |
| Public/private toggle | Yes (via edit) |

## 7. Schema additions vs blueprint

The `projects` table includes two extra columns beyond `DATABASE_SCHEMA.md`:

- `category text` — display grouping used by the dashboard UI
- `grant_relevance text` — short relevance summary shown on cards

These are non-breaking additions that keep the UI consistent with the mock data.
