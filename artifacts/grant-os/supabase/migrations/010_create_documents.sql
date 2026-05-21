-- Migration: 010_create_documents
-- Grant OS V0.9 — Documents metadata and extraction foundation

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type text not null default 'general'
    check (document_type in ('grant_guidelines', 'application_form', 'budget_template', 'letter_of_support', 'proof_document', 'funder_document', 'report', 'general')),
  file_name text,
  file_path text,
  file_url text,
  source_url text,
  mime_type text,
  file_size_bytes bigint,
  extracted_text text,
  extraction_status text not null default 'not_started'
    check (extraction_status in ('not_started', 'pending', 'completed', 'failed', 'unsupported')),
  extraction_error text,
  metadata jsonb,
  related_project_id uuid references public.projects(id) on delete set null,
  related_grant_id uuid references public.grants(id) on delete set null,
  related_funder_id uuid references public.funders(id) on delete set null,
  related_application_id uuid references public.applications(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_documents_project on public.documents(related_project_id) where archived_at is null;
create index if not exists idx_documents_grant on public.documents(related_grant_id) where archived_at is null;
create index if not exists idx_documents_funder on public.documents(related_funder_id) where archived_at is null;
create index if not exists idx_documents_application on public.documents(related_application_id) where archived_at is null;
create index if not exists idx_documents_type on public.documents(document_type);
create index if not exists idx_documents_created_at on public.documents(created_at desc);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute procedure public.set_updated_at();

alter table public.documents enable row level security;

drop policy if exists "auth_select_documents" on public.documents;
drop policy if exists "auth_insert_documents" on public.documents;
drop policy if exists "auth_update_documents" on public.documents;
drop policy if exists "auth_delete_documents" on public.documents;
drop policy if exists "auth_insert_contributor_documents" on public.documents;
drop policy if exists "auth_update_contributor_own_documents" on public.documents;

create policy "auth_select_documents"
  on public.documents for select
  using (auth.uid() is not null);

create policy "auth_insert_documents"
  on public.documents for insert
  with check (public.can_write());

create policy "auth_update_documents"
  on public.documents for update
  using (public.can_write())
  with check (public.can_write());

create policy "auth_delete_documents"
  on public.documents for delete
  using (public.can_write());

create policy "auth_insert_contributor_documents"
  on public.documents for insert
  with check (public.current_user_role() = 'Contributor' and coalesce(uploaded_by, auth.uid()) = auth.uid());

create policy "auth_update_contributor_own_documents"
  on public.documents for update
  using (public.current_user_role() = 'Contributor' and uploaded_by = auth.uid())
  with check (public.current_user_role() = 'Contributor' and uploaded_by = auth.uid());

-- Storage bucket setup is documented in SUPABASE_SETUP.md. The bucket should be private.
