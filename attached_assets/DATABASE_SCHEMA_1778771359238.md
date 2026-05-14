# Database Schema Blueprint

## Database
PostgreSQL via Supabase.

## Conventions

- Primary keys: `uuid`.
- Timestamps: `created_at`, `updated_at`.
- Foreign keys should be explicit.
- Use soft archive where possible: `archived_at`.
- Store AI outputs separately for traceability.
- Use `public_visibility` to control what can appear on public website.

## Enums

### user_role
- admin
- grant_lead
- contributor
- reviewer
- viewer

### grant_status
- discovered
- needs_review
- shortlisted
- top_3_priority
- preparing
- drafting
- internal_review
- ready_to_submit
- submitted
- won
- rejected
- archived

### application_status
- not_started
- preparing
- drafting
- internal_review
- ready_to_submit
- submitted
- won
- rejected
- archived

### task_status
- not_started
- in_progress
- waiting
- needs_review
- complete

### task_priority
- low
- medium
- high
- urgent

### proof_item_type
- workshop
- event
- app_demo
- screenshot
- testimonial
- metric
- document
- case_study
- video
- media_mention
- team_credential
- partner_collaborator
- community_output

### ai_output_type
- grant_summary
- fit_analysis
- draft_answer
- proof_suggestion
- funder_summary
- peer_funding_analysis
- readiness_report

## Tables

## organizations
Stores organizations/communities using the system.

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  mission text,
  type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## users
Stores user profile metadata connected to auth users.

```sql
create table users (
  id uuid primary key,
  organization_id uuid references organizations(id),
  name text,
  email text unique not null,
  role user_role not null default 'viewer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## projects
Project profiles are the foundation for grant matching and public case studies.

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  slug text unique not null,
  summary text,
  problem_statement text,
  solution text,
  target_audience text,
  geography text,
  stage text,
  technology text,
  impact text,
  reusable_grant_language text,
  public_visibility boolean default false,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## proof_items
Reusable proof assets for public website and grant applications.

```sql
create table proof_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  project_id uuid references projects(id),
  title text not null,
  type proof_item_type not null,
  description text,
  date date,
  media_url text,
  document_url text,
  metrics jsonb,
  tags text[],
  grant_relevance text,
  suggested_language text,
  public_visibility boolean default false,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## funders
Funder profiles for foundations, institutions, agencies, and grantmakers.

```sql
create table funders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text,
  website text,
  location text,
  assets numeric,
  annual_giving numeric,
  median_grant_amount numeric,
  contact_info jsonb,
  key_people jsonb,
  openness_to_new_grantees text,
  notes text,
  source_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## grants
Grant opportunities or RFPs.

```sql
create table grants (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  funder_id uuid references funders(id),
  deadline date,
  amount_min numeric,
  amount_max numeric,
  focus_areas text[],
  geography text,
  eligibility text,
  application_url text,
  source_url text,
  required_documents jsonb,
  application_questions jsonb,
  status grant_status default 'discovered',
  assigned_owner_id uuid references users(id),
  notes text,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## grant_matches
Scores and reasoning connecting grants to projects.

```sql
create table grant_matches (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references grants(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  fit_score integer check (fit_score between 0 and 100),
  priority_score integer check (priority_score between 0 and 100),
  urgency_score integer check (urgency_score between 0 and 100),
  difficulty_score integer check (difficulty_score between 0 and 100),
  ai_reasoning text,
  recommendation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(grant_id, project_id)
);
```

## applications
Application workspace records.

```sql
create table applications (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references grants(id) not null,
  project_id uuid references projects(id) not null,
  owner_id uuid references users(id),
  status application_status default 'not_started',
  google_doc_url text,
  drive_folder_url text,
  portal_url text,
  submitted_at timestamptz,
  result text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## application_questions
Question-level drafting and review.

```sql
create table application_questions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  question text not null,
  word_limit integer,
  draft_answer text,
  final_answer text,
  owner_id uuid references users(id),
  status text default 'not_started',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## tasks
Task management for grants, projects, and applications.

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  owner_id uuid references users(id),
  related_grant_id uuid references grants(id),
  related_project_id uuid references projects(id),
  related_application_id uuid references applications(id),
  due_date date,
  status task_status default 'not_started',
  priority task_priority default 'medium',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## peer_organizations
Organizations used for funder intelligence research.

```sql
create table peer_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ein text,
  website text,
  description text,
  notes text,
  source_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## peer_funding_records
Funding history from peer orgs, usually sourced from 990/public data.

```sql
create table peer_funding_records (
  id uuid primary key default gen_random_uuid(),
  peer_organization_id uuid references peer_organizations(id) on delete cascade not null,
  funder_id uuid references funders(id),
  year integer,
  amount numeric,
  source_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## application_proof_items
Links proof items to applications.

```sql
create table application_proof_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  proof_item_id uuid references proof_items(id) on delete cascade not null,
  relevance_note text,
  created_at timestamptz default now(),
  unique(application_id, proof_item_id)
);
```

## documents
Stores uploaded files or external document links.

```sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  title text not null,
  file_url text,
  external_url text,
  document_type text,
  related_project_id uuid references projects(id),
  related_grant_id uuid references grants(id),
  related_application_id uuid references applications(id),
  notes text,
  public_visibility boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## ai_outputs
Stores AI-generated summaries, recommendations, and drafts.

```sql
create table ai_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  type ai_output_type not null,
  related_project_id uuid references projects(id),
  related_grant_id uuid references grants(id),
  related_funder_id uuid references funders(id),
  related_application_id uuid references applications(id),
  input_snapshot jsonb,
  output jsonb,
  model text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);
```

## Recommended Indexes

```sql
create index idx_grants_status on grants(status);
create index idx_grants_deadline on grants(deadline);
create index idx_grants_funder on grants(funder_id);
create index idx_projects_org on projects(organization_id);
create index idx_proof_items_project on proof_items(project_id);
create index idx_tasks_owner on tasks(owner_id);
create index idx_tasks_due_date on tasks(due_date);
create index idx_applications_status on applications(status);
create index idx_peer_funding_peer on peer_funding_records(peer_organization_id);
create index idx_peer_funding_funder on peer_funding_records(funder_id);
```

## Row Level Security Notes

V1 can use simple protected server routes. When RLS is added:

- Admins can read/write all records in their organization.
- Grant leads can read/write grants, funders, applications, tasks, and proof.
- Contributors can read projects/grants and write assigned proof/questions/tasks.
- Reviewers can read assigned applications and update review statuses/comments later.
- Viewers can read only.
- Public website can read only `public_visibility = true` records.
