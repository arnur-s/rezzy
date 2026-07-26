begin;

select plan(24);

-- Contract: the RPC is reachable from the browser, runs with definer rights and
-- an empty search path, and is never exposed to anonymous callers.

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_onboarding'
  ),
  'complete_onboarding function exists'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_onboarding'
  ),
  'complete_onboarding runs as security definer'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join unnest(p.proconfig) as cfg
    where n.nspname = 'public'
      and p.proname = 'complete_onboarding'
      and split_part(cfg, '=', 1) = 'search_path'
      and btrim(split_part(cfg, '=', 2), '"') = ''
  ),
  'complete_onboarding pins an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.complete_onboarding(text, text)',
    'execute'
  ),
  'authenticated users can execute complete_onboarding'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.complete_onboarding(text, text)',
    'execute'
  ),
  'anonymous users cannot execute complete_onboarding'
);

-- Three users: A onboards, B onboards separately, C only sends invalid input.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-0000000000a1',
    'onboarding-a@example.com',
    '{"full_name":"Signup Name A"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-0000000000b1',
    'onboarding-b@example.com',
    '{"full_name":"Signup Name B"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-0000000000c1',
    'onboarding-c@example.com',
    '{"full_name":"Charlie Signup"}'::jsonb
  );

-- === User A: a new authenticated user completes onboarding =================

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select results_eq(
  $$
    select is_new
    from public.complete_onboarding('  Ada Lovelace  ', '  Acme Sales  ')
  $$,
  $$ values (true) $$,
  'a new authenticated user completes onboarding'
);

select results_eq(
  $$
    select p.full_name, p.email
    from public.profiles p
    where p.id = '00000000-0000-4000-8000-0000000000a1'
  $$,
  $$ values ('Ada Lovelace'::text, 'onboarding-a@example.com'::text) $$,
  'the profile keeps the auth email and takes the trimmed submitted name'
);

select results_eq(
  $$
    select w.name, w.is_main, w.created_by, w.description
    from public.workspaces w
    where w.created_by = '00000000-0000-4000-8000-0000000000a1'
  $$,
  $$
    values (
      'Acme Sales'::text,
      true,
      '00000000-0000-4000-8000-0000000000a1'::uuid,
      null::text
    )
  $$,
  'the workspace is created as the main workspace with a trimmed name'
);

select results_eq(
  $$
    select wm.role, wm.workspace_id = (
      select w.id
      from public.workspaces w
      where w.created_by = '00000000-0000-4000-8000-0000000000a1'
    )
    from public.workspace_members wm
    where wm.user_id = '00000000-0000-4000-8000-0000000000a1'
  $$,
  $$ values ('owner'::text, true) $$,
  'the caller becomes the owner of the workspace they created'
);

-- Duplicate submissions, retries and refreshes all land here.
select results_eq(
  $$
    select
      workspace_id = (
        select w.id
        from public.workspaces w
        where w.created_by = '00000000-0000-4000-8000-0000000000a1'
      ),
      is_new
    from public.complete_onboarding('Ada Lovelace', 'Second Workspace')
  $$,
  $$ values (true, false) $$,
  'a repeat call returns the existing workspace instead of creating another'
);

select is(
  (
    select count(*)
    from public.workspaces w
    where w.created_by = '00000000-0000-4000-8000-0000000000a1'
  ),
  1::bigint,
  'duplicate calls do not create a second workspace'
);

select is(
  (
    select count(*)
    from public.workspace_members wm
    where wm.user_id = '00000000-0000-4000-8000-0000000000a1'
  ),
  1::bigint,
  'duplicate calls do not create a second membership'
);

select is(
  (
    select w.name
    from public.workspaces w
    where w.created_by = '00000000-0000-4000-8000-0000000000a1'
  ),
  'Acme Sales'::text,
  'a repeat call does not rename the existing workspace'
);

-- === User C: invalid input must not create partial records =================

set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}';

select throws_ok(
  $$ select * from public.complete_onboarding('   ', 'Acme Sales') $$,
  '22023',
  null,
  'a whitespace-only full name is rejected'
);

select throws_ok(
  $$ select * from public.complete_onboarding('Charlie Parker', '  a  ') $$,
  '22023',
  null,
  'a workspace name shorter than two characters is rejected'
);

select throws_ok(
  $$
    select *
    from public.complete_onboarding(repeat('a', 81), 'Acme Sales')
  $$,
  '22023',
  null,
  'an over-length full name is rejected'
);

select throws_ok(
  $$
    select *
    from public.complete_onboarding('Charlie Parker', repeat('b', 61))
  $$,
  '22023',
  null,
  'an over-length workspace name is rejected'
);

select is(
  (
    select count(*)
    from public.workspace_members wm
    where wm.user_id = '00000000-0000-4000-8000-0000000000c1'
  ),
  0::bigint,
  'invalid input creates no workspace or membership'
);

select is(
  (
    select p.full_name
    from public.profiles p
    where p.id = '00000000-0000-4000-8000-0000000000c1'
  ),
  'Charlie Signup'::text,
  'invalid input leaves the profile untouched'
);

-- === User B: workspace scoping holds across users ==========================

set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select results_eq(
  $$
    select is_new
    from public.complete_onboarding('Grace Hopper', 'Hopper Support')
  $$,
  $$ values (true) $$,
  'a second user onboards into their own workspace'
);

select is(
  (
    select count(*)
    from public.workspaces w
    where w.created_by = '00000000-0000-4000-8000-0000000000a1'
  ),
  0::bigint,
  'RLS hides another user''s workspace'
);

select is(
  (
    select count(*)
    from public.workspace_members wm
    where wm.user_id = '00000000-0000-4000-8000-0000000000a1'
  ),
  0::bigint,
  'RLS hides another user''s membership'
);

-- === Unauthenticated callers ===============================================
-- Reset to a role that could otherwise write freely: the function still refuses
-- because identity comes from auth.uid(), never from a caller-supplied id.

reset role;
set local request.jwt.claims = '';

select throws_ok(
  $$ select * from public.complete_onboarding('Nobody', 'No Workspace') $$,
  '28000',
  null,
  'unauthenticated calls fail'
);

select is(
  (
    select count(*)
    from public.workspaces w
    where w.name = 'No Workspace'
  ),
  0::bigint,
  'a rejected unauthenticated call creates nothing'
);

select * from finish();

rollback;
