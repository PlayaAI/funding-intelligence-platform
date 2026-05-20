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

## 2. Run Migrations (in order)

Open your Supabase project, go to **SQL Editor**, and run each file in order:

1. `artifacts/grant-os/supabase/migrations/001_create_projects.sql`
2. `002_create_proof_items.sql`
3. `003_create_grants.sql`
4. `004_create_funders_peers.sql`
5. `005_create_applications_tasks.sql`
6. **`006_auth_roles_rls.sql`** (V0.6 — auth, profiles, secure RLS)
7. **`007_create_imports.sql`** (V0.7 — import runs and import errors)
8. **`008_create_custom_fields.sql`** (V0.7.2 — custom field definitions)

### Using Supabase CLI (optional)

```bash
supabase db push
```

## 3. Enable Supabase Auth

In Supabase Dashboard → **Authentication** → **Providers**:

1. Enable **Email** provider.
2. For local dev, you may disable **Confirm email** (or confirm users manually).
3. Under **URL Configuration**, set **Site URL** to your app origin (e.g. `http://localhost:5173`).

## 4. Create the first admin user

**Before or after migration 006** — create the auth user first:

1. Supabase → **Authentication** → **Users** → **Add user** (email + password).
2. Run migration `006_auth_roles_rls.sql` (creates `profiles` + trigger; backfills existing users).
3. Promote to Admin in **SQL Editor**:

```sql
update public.profiles
set role = 'Admin',
    full_name = 'Your Name'
where email = 'you@example.com';
```

4. Verify:

```sql
select id, email, role from public.profiles order by created_at;
```

5. Sign in at `/login` in Grant OS and open `/dashboard`.

### Repair missing profile

If a user can sign in but sees “Account setup required”:

```sql
insert into public.profiles (id, email, full_name, role)
select id, coalesce(email, ''), null, 'Viewer'
from auth.users
where email = 'user@example.com'
on conflict (id) do nothing;
```

## 5. Roles (V0.6)

| Role | Dashboard access |
|------|------------------|
| **Admin** | Full read/write/delete on all modules |
| **Grant Lead** | Full operational write (same as Admin for CRUD; no in-app user management) |
| **Contributor** | Read all; create/edit proof items, app questions, required docs, tasks; edit applications |
| **Viewer** | Read-only |

Change roles manually: **Table Editor → profiles** or SQL:

```sql
update public.profiles set role = 'Grant Lead' where email = 'teammate@example.com';
```

Allowed values: `Admin`, `Grant Lead`, `Contributor`, `Viewer`.

There is **no in-app signup or user admin UI** in V0.6.

## 6. Row Level Security (V0.6)

- All dashboard tables require an **authenticated** Supabase session.
- **Anonymous** clients cannot read or write dashboard data.
- The **public website** still uses mock data in `src/data/*` and does not need database access.

## 7. What is real vs mock data

| Module | Data source |
|--------|-------------|
| Projects | **Supabase** |
| Proof items | **Supabase** |
| Grants | **Supabase** |
| Funders | **Supabase** |
| Peer orgs / funding records | **Supabase** |
| Applications / questions / required docs | **Supabase** |
| Tasks | **Supabase** |
| Public website pages | Mock data (`src/data/*`) |
| Tracker / matches / documents / reports (partial) | Mock or mixed |

## 8. CRUD capabilities by role

See `artifacts/grant-os/src/lib/roles.ts` for the UI permission matrix. Database enforcement is via RLS in `006_auth_roles_rls.sql`.
