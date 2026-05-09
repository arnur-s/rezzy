create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slug text not null unique,
  is_main boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint workspace_members_role_check
    check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint workspace_members_workspace_user_key unique (workspace_id, user_id)
);

create index if not exists workspaces_created_by_idx
  on public.workspaces(created_by);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members(workspace_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update on public.workspace_members to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'New user'
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set
      full_name = excluded.full_name,
      email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Users can create workspaces" on public.workspaces;
create policy "Users can create workspaces"
  on public.workspaces
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Workspace creators and members can view workspaces" on public.workspaces;
create policy "Workspace creators and members can view workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view own workspace memberships" on public.workspace_members;
create policy "Users can view own workspace memberships"
  on public.workspace_members
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Workspace creators can create owner membership" on public.workspace_members;
create policy "Workspace creators can create owner membership"
  on public.workspace_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.workspaces
      where workspaces.id = workspace_members.workspace_id
        and workspaces.created_by = auth.uid()
    )
  );
