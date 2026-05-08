begin;

select plan(22);

select ok(to_regclass('public.profiles') is not null, 'profiles table exists');
select ok(to_regclass('public.workspaces') is not null, 'workspaces table exists');
select ok(to_regclass('public.workspace_members') is not null, 'workspace_members table exists');

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'profiles_pkey'
      and conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ),
  'profiles has a primary key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'workspaces_slug_key'
      and conrelid = 'public.workspaces'::regclass
      and contype = 'u'
  ),
  'workspace slugs are unique'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_workspace_user_key'
      and conrelid = 'public.workspace_members'::regclass
      and contype = 'u'
  ),
  'workspace members are unique per workspace and user'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_role_check'
      and conrelid = 'public.workspace_members'::regclass
      and contype = 'c'
  ),
  'workspace member roles are constrained'
);

select ok(
  exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'handle_new_user'
  ),
  'new user profile trigger function exists in private schema'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ),
  'auth user creation trigger exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.workspaces'::regclass),
  'workspaces has RLS enabled'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.workspace_members'::regclass
  ),
  'workspace_members has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can view own profile'
  ),
  'profiles select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ),
  'profiles insert policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ),
  'profiles update policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspaces'
      and policyname = 'Users can create workspaces'
  ),
  'workspaces insert policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspaces'
      and policyname = 'Workspace creators and members can view workspaces'
  ),
  'workspaces select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and policyname = 'Users can view own workspace memberships'
  ),
  'workspace_members select policy exists'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and policyname = 'Workspace creators can create owner membership'
  ),
  'workspace_members insert policy exists'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'insert'),
  'authenticated users can insert profiles'
);

select ok(
  has_table_privilege('authenticated', 'public.workspaces', 'insert'),
  'authenticated users can insert workspaces'
);

select ok(
  has_table_privilege('authenticated', 'public.workspace_members', 'insert'),
  'authenticated users can insert workspace memberships'
);

select * from finish();

rollback;
