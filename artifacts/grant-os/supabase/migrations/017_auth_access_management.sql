-- Migration: 017_auth_access_management
-- Grant OS — User Access Management and Audit Columns
--
-- Safely adds access_status and audit columns to public.profiles.
-- Existing users are defaulted to 'approved' to prevent lockout.
--
-- =====================================================================
-- SAFE ROLLBACK
-- =====================================================================
-- If this migration needs to be rolled back:
-- 
-- alter table public.profiles
--   drop column if exists access_status,
--   drop column if exists auth_provider,
--   drop column if exists approved_at,
--   drop column if exists approved_by,
--   drop column if exists rejected_at,
--   drop column if exists rejected_by,
--   drop column if exists disabled_at,
--   drop column if exists disabled_by,
--   drop column if exists last_seen_at;
-- 
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
--
-- =====================================================================

-- 1. Add columns to public.profiles
alter table public.profiles
  add column if not exists access_status text not null default 'pending'
    check (access_status in ('pending', 'approved', 'rejected', 'disabled')),
  add column if not exists auth_provider text not null default 'email',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id) on delete set null,
  add column if not exists last_seen_at timestamptz;

-- 2. Initialize existing users
-- Anyone who already exists when this migration runs is assumed to be an active user.
-- This prevents locking out the existing admin or other users.
update public.profiles
set access_status = 'approved',
    approved_at = now()
where access_status = 'pending';

-- Specifically ensure the known admin account is Admin and approved if it exists
update public.profiles
set role = 'Admin',
    access_status = 'approved'
where email = 'team@playa-ai.org';

-- 3. Update the handle_new_user trigger to explicitly set 'pending' status for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text;
begin
  -- Try to determine provider from raw_app_meta_data if available
  provider := new.raw_app_meta_data->>'provider';
  if provider is null then
    provider := 'email';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    access_status,
    auth_provider
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    'Viewer',
    'pending',
    provider
  );
  return new;
end;
$$;
