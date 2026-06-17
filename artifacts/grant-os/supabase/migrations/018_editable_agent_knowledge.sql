-- Migration: 018_editable_agent_knowledge
-- Adds tables and RLS for editable Agent Knowledge Base and Proposals.

-- 1. Helper function for checking approved access
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and access_status = 'approved'
  );
$$;

grant execute on function public.is_approved() to authenticated;

-- 2. Create agent_knowledge_items
create table if not exists public.agent_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  content text not null,
  status text not null default 'active'
    check (status in ('active', 'draft', 'archived')),
  knowledge_type text not null
    check (knowledge_type in (
      'approved_fact', 'project_angle', 'matching_rule', 'readiness_rule', 
      'risky_claim', 'safer_language', 'proof_requirement', 'application_instruction', 
      'custom_instruction', 'template', 'do_not_use', 'folder_rule', 'daily_ops_rule'
    )),
  priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  confidence_status text not null default 'approved'
    check (confidence_status in ('approved', 'needs_confirmation', 'background_only', 'do_not_use', 'outdated')),
  applies_to text[],
  example text,
  source_label text,
  source_url text,
  source_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_knowledge_items_status on public.agent_knowledge_items(status);
create index if not exists idx_agent_knowledge_items_category on public.agent_knowledge_items(category);

drop trigger if exists agent_knowledge_items_set_updated_at on public.agent_knowledge_items;
create trigger agent_knowledge_items_set_updated_at
  before update on public.agent_knowledge_items
  for each row execute procedure public.set_updated_at();

-- 3. Create agent_knowledge_updates (Proposals)
create table if not exists public.agent_knowledge_updates (
  id uuid primary key default gen_random_uuid(),
  proposal_type text not null
    check (proposal_type in ('add', 'edit', 'archive', 'conflict_alert', 'do_not_use_rule', 'always_rule', 'never_rule')),
  target_item_id uuid references public.agent_knowledge_items(id) on delete set null,
  title text not null,
  category text not null,
  proposed_content text not null,
  rationale text,
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
  source_type text
    check (source_type in ('user_instruction', 'agent_observation', 'notebooklm', 'uploaded_doc', 'meeting_note', 'grant_review', 'manual')),
  source_excerpt text,
  conflict_summary text,
  reviewer_notes text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_knowledge_updates_status on public.agent_knowledge_updates(status);
create index if not exists idx_agent_knowledge_updates_target on public.agent_knowledge_updates(target_item_id);

drop trigger if exists agent_knowledge_updates_set_updated_at on public.agent_knowledge_updates;
create trigger agent_knowledge_updates_set_updated_at
  before update on public.agent_knowledge_updates
  for each row execute procedure public.set_updated_at();


-- 4. Enable RLS
alter table public.agent_knowledge_items enable row level security;
alter table public.agent_knowledge_updates enable row level security;

-- 5. RLS Policies for agent_knowledge_items
drop policy if exists "auth_select_agent_knowledge_items" on public.agent_knowledge_items;
create policy "auth_select_agent_knowledge_items"
  on public.agent_knowledge_items for select
  using (public.is_approved());

drop policy if exists "auth_insert_agent_knowledge_items" on public.agent_knowledge_items;
create policy "auth_insert_agent_knowledge_items"
  on public.agent_knowledge_items for insert
  with check (public.is_approved() and public.is_admin());

drop policy if exists "auth_update_agent_knowledge_items" on public.agent_knowledge_items;
create policy "auth_update_agent_knowledge_items"
  on public.agent_knowledge_items for update
  using (public.is_approved() and public.is_admin())
  with check (public.is_approved() and public.is_admin());

drop policy if exists "auth_delete_agent_knowledge_items" on public.agent_knowledge_items;
create policy "auth_delete_agent_knowledge_items"
  on public.agent_knowledge_items for delete
  using (public.is_approved() and public.is_admin());

-- 6. RLS Policies for agent_knowledge_updates (Proposals)
drop policy if exists "auth_select_agent_knowledge_updates" on public.agent_knowledge_updates;
create policy "auth_select_agent_knowledge_updates"
  on public.agent_knowledge_updates for select
  using (public.is_approved());

-- Any approved user can propose an update
drop policy if exists "auth_insert_agent_knowledge_updates" on public.agent_knowledge_updates;
create policy "auth_insert_agent_knowledge_updates"
  on public.agent_knowledge_updates for insert
  with check (public.is_approved());

-- Only admins can update proposals (to approve/reject or edit them before approval)
drop policy if exists "auth_update_agent_knowledge_updates" on public.agent_knowledge_updates;
create policy "auth_update_agent_knowledge_updates"
  on public.agent_knowledge_updates for update
  using (public.is_approved() and public.is_admin())
  with check (public.is_approved() and public.is_admin());

drop policy if exists "auth_delete_agent_knowledge_updates" on public.agent_knowledge_updates;
create policy "auth_delete_agent_knowledge_updates"
  on public.agent_knowledge_updates for delete
  using (public.is_approved() and public.is_admin());
