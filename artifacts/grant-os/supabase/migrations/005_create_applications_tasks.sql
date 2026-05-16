-- Migration: 005_create_applications_tasks
-- Grant OS V0.5 — Supabase-backed applications + tasks CRUD
-- Run after 001–004

-- ============================================================
-- TABLE: applications
-- ============================================================

create table if not exists applications (
  id                uuid primary key default gen_random_uuid(),
  grant_id          uuid references grants(id) on delete set null,
  project_id        uuid references projects(id) on delete set null,
  title             text not null,
  status            text not null default 'Drafting'
    check (status in (
      'Not Started', 'Drafting', 'Internal Review', 'Ready to Submit',
      'Submitted', 'Awarded', 'Declined', 'Archived'
    )),
  owner_name        text,
  google_doc_url    text,
  drive_folder_url  text,
  portal_url        text,
  submitted_at      timestamptz,
  result            text,
  notes             text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_applications_grant_id    on applications(grant_id);
create index if not exists idx_applications_project_id  on applications(project_id);
create index if not exists idx_applications_status      on applications(status);
create index if not exists idx_applications_archived    on applications(archived_at);

drop trigger if exists applications_set_updated_at on applications;
create trigger applications_set_updated_at
  before update on applications
  for each row execute procedure set_updated_at();

-- ============================================================
-- TABLE: application_questions
-- ============================================================

create table if not exists application_questions (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  question        text not null,
  word_limit      integer,
  draft_answer    text,
  final_answer    text,
  owner_name      text,
  status          text not null default 'Draft'
    check (status in ('Draft', 'Needs Review', 'Approved', 'Final')),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_app_questions_app_id     on application_questions(application_id);
create index if not exists idx_app_questions_status     on application_questions(status);
create index if not exists idx_app_questions_sort       on application_questions(sort_order);

drop trigger if exists app_questions_set_updated_at on application_questions;
create trigger app_questions_set_updated_at
  before update on application_questions
  for each row execute procedure set_updated_at();

-- ============================================================
-- TABLE: application_required_documents
-- ============================================================

create table if not exists application_required_documents (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  title           text not null,
  description     text,
  status          text not null default 'Needed'
    check (status in ('Needed', 'In Progress', 'Complete', 'Not Applicable')),
  url             text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_app_req_docs_app_id  on application_required_documents(application_id);
create index if not exists idx_app_req_docs_status  on application_required_documents(status);

drop trigger if exists app_req_docs_set_updated_at on application_required_documents;
create trigger app_req_docs_set_updated_at
  before update on application_required_documents
  for each row execute procedure set_updated_at();

-- ============================================================
-- TABLE: tasks
-- ============================================================

create table if not exists tasks (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  description             text,
  owner_name              text,
  status                  text not null default 'Not Started'
    check (status in (
      'Not Started', 'In Progress', 'Waiting', 'Needs Review', 'Complete', 'Archived'
    )),
  priority                text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  due_date                text,
  related_project_id      uuid references projects(id) on delete set null,
  related_grant_id        uuid references grants(id) on delete set null,
  related_application_id  uuid references applications(id) on delete cascade,
  related_proof_item_id   uuid references proof_items(id) on delete set null,
  notes                   text,
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_tasks_grant_id       on tasks(related_grant_id);
create index if not exists idx_tasks_project_id     on tasks(related_project_id);
create index if not exists idx_tasks_application_id on tasks(related_application_id);
create index if not exists idx_tasks_status         on tasks(status);
create index if not exists idx_tasks_priority       on tasks(priority);
create index if not exists idx_tasks_due_date       on tasks(due_date);
create index if not exists idx_tasks_archived       on tasks(archived_at);

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute procedure set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
--
-- ⚠️  DEVELOPMENT / DEMO POLICIES — REPLACE BEFORE PRODUCTION ⚠️
--
-- These policies allow full anon read/write so the Vite frontend
-- can operate without authentication during development.
--
-- ============================================================

alter table applications enable row level security;
alter table application_questions enable row level security;
alter table application_required_documents enable row level security;
alter table tasks enable row level security;

-- applications
create policy "demo_anon_select_applications" on applications for select using (true);
create policy "demo_anon_insert_applications" on applications for insert with check (true);
create policy "demo_anon_update_applications" on applications for update using (true);
create policy "demo_anon_delete_applications" on applications for delete using (true);

-- application_questions
create policy "demo_anon_select_app_questions" on application_questions for select using (true);
create policy "demo_anon_insert_app_questions" on application_questions for insert with check (true);
create policy "demo_anon_update_app_questions" on application_questions for update using (true);
create policy "demo_anon_delete_app_questions" on application_questions for delete using (true);

-- application_required_documents
create policy "demo_anon_select_app_req_docs" on application_required_documents for select using (true);
create policy "demo_anon_insert_app_req_docs" on application_required_documents for insert with check (true);
create policy "demo_anon_update_app_req_docs" on application_required_documents for update using (true);
create policy "demo_anon_delete_app_req_docs" on application_required_documents for delete using (true);

-- tasks
create policy "demo_anon_select_tasks" on tasks for select using (true);
create policy "demo_anon_insert_tasks" on tasks for insert with check (true);
create policy "demo_anon_update_tasks" on tasks for update using (true);
create policy "demo_anon_delete_tasks" on tasks for delete using (true);

-- ============================================================
-- SEED: applications (from mock a1, a2, a3)
-- ============================================================

insert into applications (
  id, grant_id, project_id, title, status, owner_name,
  google_doc_url, drive_folder_url, portal_url, submitted_at, notes
) values
  (
    '55555555-5555-4555-8555-555555550001',
    '11111111-1111-4111-8111-111111110004',
    (select id from projects where slug = 'connect-app' limit 1),
    'Wellspring Foundation — Loneliness & Social Health',
    'Drafting',
    'Aaron Coombs',
    'https://docs.google.com/document/d/placeholder',
    'https://drive.google.com/drive/folders/placeholder',
    null, null,
    'Sarah Chen (program officer) has seen our work. Warm relationship. Be specific about field testing numbers.'
  ),
  (
    '55555555-5555-4555-8555-555555550002',
    '11111111-1111-4111-8111-111111110001',
    (select id from projects where slug = 'connect-app' limit 1),
    'MIT Solve — Indigenous Communities Fellowship',
    'Not Started',
    'Aaron Coombs',
    null, null, null, null,
    'Need to check exact eligibility. Consider reaching out to MIT Solve Slack community.'
  ),
  (
    '55555555-5555-4555-8555-555555550003',
    '11111111-1111-4111-8111-111111110006',
    (select id from projects where slug = 'oracle' limit 1),
    'Burning Man Project — Arts & Community Innovation',
    'Submitted',
    'Aaron Coombs',
    'https://docs.google.com/document/d/placeholder2',
    null, null,
    '2026-03-29T00:00:00Z',
    'Submitted on time. Strong application. Awaiting decision.'
  )
on conflict (id) do nothing;

-- ============================================================
-- SEED: application_questions
-- ============================================================

insert into application_questions (
  id, application_id, question, word_limit, draft_answer, final_answer,
  owner_name, status, sort_order
) values
  -- a1 questions (Wellspring)
  (
    '66666666-6666-4666-8666-666666660001',
    '55555555-5555-4555-8555-555555550001',
    'Describe your organization and the problem you are addressing.',
    300,
    'Playa AI is a community technology group building tools for human connection and community flourishing. We address the epidemic of loneliness through technology that encourages authentic, face-to-face interaction rather than screen-mediated communication.',
    null,
    'Aaron Coombs', 'Needs Review', 0
  ),
  (
    '66666666-6666-4666-8666-666666660002',
    '55555555-5555-4555-8555-555555550001',
    'What is your theory of change? How does your work reduce social isolation?',
    400, null, null,
    'Aaron Coombs', 'Draft', 1
  ),
  (
    '66666666-6666-4666-8666-666666660003',
    '55555555-5555-4555-8555-555555550001',
    'Describe your proof of concept and any community validation.',
    400,
    'The Connect App was field tested during Burning Man 2024 in a real-world intentional community setting. Multiple guided connection sessions were completed with positive qualitative feedback from participants.',
    null,
    'Aaron Coombs', 'Needs Review', 2
  ),
  (
    '66666666-6666-4666-8666-666666660004',
    '55555555-5555-4555-8555-555555550001',
    'What is your budget for this project and how will the grant funds be used?',
    200, null, null,
    'Aaron Coombs', 'Draft', 3
  ),
  -- a2 questions (MIT Solve)
  (
    '66666666-6666-4666-8666-666666660005',
    '55555555-5555-4555-8555-555555550002',
    'What problem are you solving and why does it matter now?',
    250, null, null,
    'Aaron Coombs', 'Draft', 0
  ),
  (
    '66666666-6666-4666-8666-666666660006',
    '55555555-5555-4555-8555-555555550002',
    'Describe your solution and how it works.',
    350, null, null,
    'Aaron Coombs', 'Draft', 1
  ),
  -- a3 questions (Burning Man)
  (
    '66666666-6666-4666-8666-666666660007',
    '55555555-5555-4555-8555-555555550003',
    'Describe your art project or community innovation.',
    500,
    'Oracle is an interactive AI experience that blends contemplative tradition with experimental AI interaction design. Community members engage with an AI-generated oracle at community events, exploring reflection and meaning.',
    'Oracle is an interactive AI experience that blends contemplative tradition with experimental AI interaction design. Community members engage with an AI-generated oracle at community events, exploring reflection and meaning-making in a shared ritual context. The experience has been presented at three community events with over 200 participants.',
    'Aaron Coombs', 'Final', 0
  )
on conflict (id) do nothing;

-- ============================================================
-- SEED: application_required_documents
-- ============================================================

insert into application_required_documents (
  id, application_id, title, description, status, url, sort_order
) values
  -- a1 docs (Wellspring)
  ('77777777-7777-4777-8777-777777770001', '55555555-5555-4555-8555-555555550001', 'Project Budget', 'Draft in progress', 'In Progress', null, 0),
  ('77777777-7777-4777-8777-777777770002', '55555555-5555-4555-8555-555555550001', 'Letter of Support', 'Need from community partner', 'Needed', null, 1),
  ('77777777-7777-4777-8777-777777770003', '55555555-5555-4555-8555-555555550001', 'Team Bios', null, 'Complete', null, 2),
  ('77777777-7777-4777-8777-777777770004', '55555555-5555-4555-8555-555555550001', '501c3 Status or Fiscal Sponsor Letter', 'Exploring fiscal sponsorship with Fractured Atlas', 'Needed', null, 3),
  -- a2 docs (MIT Solve)
  ('77777777-7777-4777-8777-777777770005', '55555555-5555-4555-8555-555555550002', 'Organization Overview', null, 'Complete', null, 0),
  ('77777777-7777-4777-8777-777777770006', '55555555-5555-4555-8555-555555550002', 'Project Budget', null, 'Needed', null, 1),
  ('77777777-7777-4777-8777-777777770007', '55555555-5555-4555-8555-555555550002', 'Team Overview', null, 'Complete', null, 2),
  -- a3 docs (Burning Man)
  ('77777777-7777-4777-8777-777777770008', '55555555-5555-4555-8555-555555550003', 'Project Description', null, 'Complete', null, 0),
  ('77777777-7777-4777-8777-777777770009', '55555555-5555-4555-8555-555555550003', 'Budget', null, 'Complete', null, 1),
  ('77777777-7777-4777-8777-777777770010', '55555555-5555-4555-8555-555555550003', 'Photos/Demo', null, 'Complete', null, 2)
on conflict (id) do nothing;

-- ============================================================
-- SEED: tasks (from mock t1–t10)
-- ============================================================

insert into tasks (
  id, title, description, owner_name, status, priority, due_date,
  related_grant_id, related_project_id, related_application_id, notes
) values
  (
    '88888888-8888-4888-8888-888888880001',
    'Draft budget narrative for Wellspring application',
    'Create a clear, itemized budget for the Connect App grant application. Include personnel, technology costs, and community event costs.',
    'Aaron Coombs', 'In Progress', 'High', '2026-05-20',
    '11111111-1111-4111-8111-111111110004',
    (select id from projects where slug = 'connect-app' limit 1),
    '55555555-5555-4555-8555-555555550001',
    null
  ),
  (
    '88888888-8888-4888-8888-888888880002',
    'Secure letter of support from community partner',
    'Reach out to community partner (Intentional Community Network contact) for a letter supporting the Connect App work.',
    'Aaron Coombs', 'Not Started', 'High', '2026-05-22',
    '11111111-1111-4111-8111-111111110004',
    null,
    '55555555-5555-4555-8555-555555550001',
    null
  ),
  (
    '88888888-8888-4888-8888-888888880003',
    'Research fiscal sponsorship options',
    'Evaluate Fractured Atlas, NFCB, and Open Collective as fiscal sponsorship options. Determine timeline and requirements.',
    'Aaron Coombs', 'In Progress', 'High', '2026-05-25',
    null, null, null, null
  ),
  (
    '88888888-8888-4888-8888-888888880004',
    'Complete MIT Solve eligibility check',
    'Review MIT Solve challenge criteria in detail and confirm eligibility for current organizational structure.',
    'Aaron Coombs', 'Not Started', 'High', '2026-05-28',
    '11111111-1111-4111-8111-111111110001',
    null, null, null
  ),
  (
    '88888888-8888-4888-8888-888888880005',
    'Draft Connect App theory of change section',
    'Write 400-word response explaining how Connect App''s guided interaction model reduces loneliness and builds social capital.',
    'Aaron Coombs', 'In Progress', 'High', '2026-05-21',
    '11111111-1111-4111-8111-111111110004',
    null,
    '55555555-5555-4555-8555-555555550001',
    null
  ),
  (
    '88888888-8888-4888-8888-888888880006',
    'Add Connect App field test session count to proof items',
    'Document the exact number of guided connection sessions completed during Burning Man 2024. Add to proof database.',
    'Aaron Coombs', 'Not Started', 'Medium', '2026-05-18',
    null,
    (select id from projects where slug = 'connect-app' limit 1),
    null, null
  ),
  (
    '88888888-8888-4888-8888-888888880007',
    'Research Knight Foundation program officer',
    'Identify the correct Knight Foundation program officer for civic technology grants and review their recent public statements.',
    'Aaron Coombs', 'Not Started', 'Medium', '2026-06-10',
    '11111111-1111-4111-8111-111111110003',
    null, null, null
  ),
  (
    '88888888-8888-4888-8888-888888880008',
    'Add Ikigai App proof items from March workshop',
    'Document the Ikigai Discovery Workshop outputs: participant count, feedback themes, and framework outputs.',
    'Aaron Coombs', 'Not Started', 'Low', '2026-06-01',
    null,
    (select id from projects where slug = 'ikigai' limit 1),
    null, null
  ),
  (
    '88888888-8888-4888-8888-888888880009',
    'Follow up with Wellspring — Sarah Chen',
    'Send a brief update note to Sarah Chen at Wellspring about application progress. Mention the fiscal sponsorship path.',
    'Aaron Coombs', 'Complete', 'High', '2026-05-19',
    '11111111-1111-4111-8111-111111110004',
    null, null, null
  ),
  (
    '88888888-8888-4888-8888-888888880010',
    'Review Mozilla Foundation open application requirements',
    'Download and review Mozilla Foundation grant program guidelines for current cycle. Note specific eligibility criteria.',
    'Aaron Coombs', 'Not Started', 'Medium', '2026-06-15',
    '11111111-1111-4111-8111-111111110002',
    null, null, null
  )
on conflict (id) do nothing;
