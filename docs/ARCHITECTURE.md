# Technical Architecture

## Recommended Stack

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod validation
- Recharts for dashboard charts

### Backend
- Next.js server actions or API routes
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage for uploaded docs/media

### AI Layer
- OpenAI or Claude API
- Structured JSON outputs
- Server-side calls only
- Prompt templates stored in `/lib/ai/prompts`
- AI results stored in database for traceability

### Deployment
- Vercel for app
- Supabase for database/auth/storage
- GitHub repository
- Optional cron jobs for scheduled scans later

## Architecture Philosophy

Build a simple, typed, modular app first. Do not overbuild autonomous agents, scraping pipelines, or complex integrations until the core dashboard workflow is stable.

## Suggested Repository Structure

```txt
/app
  /(public)
    page.tsx
    projects/page.tsx
    projects/[slug]/page.tsx
    workshops/page.tsx
    proof/page.tsx
    team/page.tsx
    contact/page.tsx
  /(auth)
    login/page.tsx
  /dashboard
    page.tsx
    projects/page.tsx
    projects/[id]/page.tsx
    grants/page.tsx
    grants/[id]/page.tsx
    funders/page.tsx
    funders/[id]/page.tsx
    peers/page.tsx
    peers/[id]/page.tsx
    applications/page.tsx
    applications/[id]/page.tsx
    tasks/page.tsx
    proof/page.tsx
    settings/page.tsx
/components
  /public
  /dashboard
  /forms
  /tables
  /cards
  /layout
  /ui
/lib
  /supabase
  /db
  /actions
  /ai
    /prompts
    /schemas
  /validators
  /utils
/types
  database.ts
  app.ts
/docs
  MASTER_BUILD_SPEC.md
/supabase
  migrations
  seed.sql
```

## App Layers

### Public Website Layer
- Publicly accessible.
- Uses published projects and proof items.
- Can start with static/mock content.
- Later can read from database records marked `public_visibility = true`.

### Auth Layer
- Supabase Auth.
- Email/password or magic link.
- Role-based access control.
- All `/dashboard/*` routes require authentication.

### Dashboard Layer
- Private application.
- CRUD for projects, grants, funders, peers, applications, tasks, proof items.
- Should be responsive but desktop-first for internal workflows.

### Database Layer
- PostgreSQL via Supabase.
- Use Row Level Security when authentication is active.
- Use enums for statuses/roles where practical.

### AI Layer
- Server-only.
- Never expose API keys to client.
- Every AI workflow should save input, output, model, timestamp, and related entity.
- AI outputs are suggestions, not final truth.

## Data Flow Examples

### Add Grant Flow
1. User creates grant manually.
2. Grant saved to database.
3. User clicks “Analyze Fit.”
4. Server loads grant + selected project.
5. AI returns structured fit analysis.
6. Result stored in `ai_outputs` and optionally applied to `grant_matches`.
7. User reviews and accepts/rejects recommendation.

### Build Proof Package Flow
1. User opens grant detail.
2. User clicks “Suggest Proof.”
3. Server loads grant + project + proof items.
4. AI ranks proof items and explains relevance.
5. User selects proof items for application.
6. Selected items saved as application proof links.

### Public Site Flow
1. Visitor opens `/projects/connect-app`.
2. Page displays public project details and public proof items.
3. No internal notes or private documents should appear publicly.

## Security Rules

- Dashboard routes require auth.
- Public pages should only show records explicitly marked public.
- AI prompts must not leak private API keys or internal credentials.
- Sensitive notes, portal logins, funder contacts, and private docs must never appear on public routes.
- Human approval required for final grant submission, external emails, and any irreversible action.

## Performance Rules

- Use server components where possible.
- Paginate large tables.
- Avoid loading all grant/funder records at once in V1.
- Cache public website pages if content is mostly static.

## Error Handling

Every CRUD form must include:

- Loading state.
- Success state.
- Error state.
- Validation errors.
- Empty state.

Every AI action must include:

- Loading state.
- Failure state.
- Retry option.
- Saved output history.

## Coding Rules for AI Agents

- Do not change unrelated files.
- Do not add dependencies unless necessary.
- Do not invent new modules without updating docs.
- Use TypeScript types.
- Validate inputs with Zod.
- Keep UI components reusable.
- Keep server-side business logic separate from UI components.
- Prefer boring, reliable architecture over clever abstractions.
