# Feature Phases

## Strategy
Build the project in phases. Each phase should produce a working, reviewable product. Do not wait until the whole platform is complete.

## Phase 0: Blueprint and Repo Setup

### Goal
Create the source-of-truth docs and initial project structure.

### Deliverables
- Blueprint docs.
- GitHub repo.
- Next.js project.
- Tailwind/shadcn setup.
- Supabase project setup.
- Basic environment variables.
- Deployment pipeline placeholder.

### Acceptance Criteria
- App runs locally.
- Public homepage placeholder exists.
- Dashboard placeholder exists.
- Docs folder exists.

## Phase 1: Clickable Prototype With Mock Data

### Goal
Make the product real visually before building complex backend logic.

### Best Tool
Replit or Claude with mock data.

### Build
Public website:
- Homepage.
- Projects page.
- Connect App case study.
- Workshops page.
- Proof page.
- Team page.
- Contact page.

Dashboard:
- Dashboard overview.
- Projects list/detail.
- Grants list/detail.
- Funders list/detail.
- Peer orgs list/detail.
- Applications workspace.
- Tasks.
- Proof items.

### Acceptance Criteria
- User can click through all major pages.
- Mock data demonstrates actual meeting-specific content.
- Dashboard shows Top 3 Focus Grants.
- Connect App appears as a flagship project.
- No backend dependency required yet.

## Phase 2: Database + Auth Foundation

### Goal
Turn prototype into a real app with persistent data.

### Build
- Supabase schema.
- Auth.
- Protected dashboard routes.
- User roles.
- Basic CRUD server actions.

### Acceptance Criteria
- Authenticated user can access dashboard.
- Unauthenticated user cannot access dashboard.
- Public website remains accessible.
- Database tables exist.
- Seed data loads successfully.

## Phase 3: Core CRUD Dashboard

### Goal
Build the internal manual operating system.

### Build
- Projects CRUD.
- Proof items CRUD.
- Grants CRUD.
- Funders CRUD.
- Peer organizations CRUD.
- Applications CRUD.
- Tasks CRUD.
- Document/link library.

### Acceptance Criteria
- User can create/edit/archive core records.
- Grant can be linked to funder and project.
- Application can be created from grant.
- Application can store Google Doc and Drive links.
- Tasks can be linked to grant/project/application.

## Phase 4: Matching and Prioritization

### Goal
Help team decide what to focus on.

### Build
- Grant-to-project match records.
- Manual fit score.
- Manual priority score.
- Urgency score based on deadline.
- Difficulty score.
- Top 3 Focus Grants feature.
- Filters/sorting.

### Acceptance Criteria
- Grants can be sorted by deadline and priority.
- Grants can be marked Top 3 Priority.
- Dashboard homepage shows Top 3.
- Grant detail shows fit reasoning.

## Phase 5: Application Workspace

### Goal
Support grant prep workflow without replacing Google Docs.

### Build
- Application workspace detail.
- Application questions.
- Draft answer/final answer fields.
- Word limits.
- Owners per question.
- Required docs checklist.
- Google Doc/Drive links.
- Submission checklist.
- Proof item linking.

### Acceptance Criteria
- Team can prepare a grant in one workspace.
- Application questions can be assigned and tracked.
- Proof items can be linked to application.
- Workspace supports “Ready to Submit” state.

## Phase 6: AI MVP

### Goal
Add AI where it saves time but keeps humans in control.

### Build
- Grant summary.
- Grant fit analysis.
- Draft answer from project profile.
- Suggest proof items.
- Store AI outputs.

### Acceptance Criteria
- User can run AI actions from grant/application pages.
- AI output is structured and reviewable.
- AI output is saved to `ai_outputs`.
- AI never submits or externally sends anything.

## Phase 7: Data Ingestion MVP

### Goal
Reduce manual entry while avoiding overcomplex scraping.

### Build
- CSV import for grants/funders.
- PDF upload support.
- URL text extraction if feasible.
- Manual peer funding record import.

### Acceptance Criteria
- User can import grant/funder records from CSV.
- Uploaded PDFs/documents can be linked to grants/applications.
- Imported records can be reviewed before saving.

## Phase 8: Peer and Funder Intelligence Expansion

### Goal
Make funder discovery more powerful.

### Build
- Peer funding records.
- Funder discovery from peer records.
- AI peer funding summary.
- AI funder recommendations.
- Relationship notes.

### Acceptance Criteria
- User can add Center for Humane Technology-style peer org.
- User can add funding records by year/funder/amount.
- System shows which funders recur.
- AI recommends funders to pursue.

## Phase 9: Automation / Agentic Workflow

### Goal
Move toward proactive grant operations.

### Build
- Weekly opportunity scan placeholder.
- Deadline reminders.
- Task reminders.
- Weekly readiness report.
- Recommended grants/funders.
- Agent audit log.

### Acceptance Criteria
- System can generate weekly priority report.
- System can list upcoming deadlines and blocked applications.
- Human approval remains required for external actions.

## Later / Not MVP

- Full Google Drive API integration.
- Full 990 parser.
- Automated scraping of all grant databases.
- Post-award reporting.
- Budget builder.
- CRM/donor management.
- External funder email automation.
- Multi-tenant SaaS billing.
