begin;

select plan(26);

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
    from pg_index
    join pg_class on pg_class.oid = pg_index.indexrelid
    where pg_class.relname = 'one_main_workspace_per_user'
      and pg_index.indrelid = 'public.workspaces'::regclass
      and pg_index.indisunique
  ),
  'users can have at most one main workspace'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_workspace_id_user_id_key'
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
      and policyname = 'Workspace members can view active workspaces'
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
  not has_table_privilege('authenticated', 'public.workspaces', 'insert')
  and has_column_privilege(
    'authenticated',
    'public.workspaces',
    'name',
    'insert'
  )
  and has_column_privilege(
    'authenticated',
    'public.workspaces',
    'created_by',
    'insert'
  )
  and not has_column_privilege(
    'authenticated',
    'public.workspaces',
    'deleted_at',
    'insert'
  ),
  'authenticated users can insert only supported workspace fields'
);

select ok(
  has_table_privilege('authenticated', 'public.workspace_members', 'insert'),
  'authenticated users can insert workspace memberships'
);

-- === Creating a workspace from the browser ================================
-- The client inserts with a returning clause, and `insert ... returning`
-- evaluates the select policy as a with-check on the new row *before* the
-- after-insert trigger creates the owner membership. A membership-only select
-- policy therefore rejects the creator's own row with 42501.

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-0000000000e1',
    'workspace-creator@example.com',
    '{"full_name":"Erin Creator"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-0000000000e2',
    'workspace-outsider@example.com',
    '{"full_name":"Oscar Outsider"}'::jsonb
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.workspaces (name, description, icon, is_main, created_by)
    values (
      'Creator Read Back',
      'A second workspace',
      'briefcase',
      false,
      '00000000-0000-4000-8000-0000000000e1'
    )
    returning id
  $$,
  'a creator can read back the workspace it just inserted'
);

select results_eq(
  $$
    select wm.role
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.name = 'Creator Read Back'
  $$,
  $$ values ('owner'::text) $$,
  'the after-insert trigger makes the creator an owner'
);

set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}';

select is_empty(
  $$
    select w.id
    from public.workspaces w
    where w.name = 'Creator Read Back'
  $$,
  'a non-member cannot see somebody else''s workspace'
);

select throws_ok(
  $$
    insert into public.workspaces (name, created_by)
    values (
      'Stolen Workspace',
      '00000000-0000-4000-8000-0000000000e1'
    )
  $$,
  '42501',
  null,
  'a user cannot create a workspace attributed to somebody else'
);

reset role;

select * from finish();

rollback;
