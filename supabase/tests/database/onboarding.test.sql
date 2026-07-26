begin;

select plan(27);

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

-- The name is no longer accepted from the caller, so the two-argument form must
-- be gone rather than left behind as a second, still-granted entry point.
select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_onboarding'
  ),
  1::bigint,
  'only the workspace-name form of complete_onboarding exists'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.complete_onboarding(text)',
    'execute'
  ),
  'authenticated users can execute complete_onboarding'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.complete_onboarding(text)',
    'execute'
  ),
  'anonymous users cannot execute complete_onboarding'
);

-- Four users: A onboards, B onboards separately, C only sends invalid input,
-- and D has lost the profile row the sign-up trigger should have created.
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
  ),
  (
    '00000000-0000-4000-8000-0000000000d1',
    'onboarding-d@example.com',
    '{"full_name":"Dana Signup"}'::jsonb
  );

-- === User A: a new authenticated user completes onboarding =================

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

select results_eq(
  $$
    select is_new
    from public.complete_onboarding('  Acme Sales  ')
  $$,
  $$ values (true) $$,
  'a new authenticated user completes onboarding'
);

-- The display name is never sent from the browser: it comes from the auth
-- metadata sign-up captured, so onboarding cannot be used to set it.
select results_eq(
  $$
    select p.full_name, p.email
    from public.profiles p
    where p.id = '00000000-0000-4000-8000-0000000000a1'
  $$,
  $$ values ('Signup Name A'::text, 'onboarding-a@example.com'::text) $$,
  'the profile keeps the name and email captured at sign-up'
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
    from public.complete_onboarding('Second Workspace')
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
  $$ select * from public.complete_onboarding('   ') $$,
  '22023',
  null,
  'a whitespace-only workspace name is rejected'
);

select throws_ok(
  $$ select * from public.complete_onboarding('  a  ') $$,
  '22023',
  null,
  'a workspace name shorter than two characters is rejected'
);

select throws_ok(
  $$ select * from public.complete_onboarding(repeat('b', 61)) $$,
  '22023',
  null,
  'an over-length workspace name is rejected'
);

select throws_ok(
  $$ select * from public.complete_onboarding(null) $$,
  '22023',
  null,
  'a null workspace name is rejected'
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

-- === User D: onboarding still works if the profile row went missing ========
-- workspaces.created_by references profiles, so the function has to be able to
-- restore the row the sign-up trigger normally owns.

reset role;
delete from public.profiles
where id = '00000000-0000-4000-8000-0000000000d1';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';

select results_eq(
  $$
    select is_new
    from public.complete_onboarding('Dana Support')
  $$,
  $$ values (true) $$,
  'a user with no profile row can still onboard'
);

select is(
  (
    select p.full_name
    from public.profiles p
    where p.id = '00000000-0000-4000-8000-0000000000d1'
  ),
  'Dana Signup'::text,
  'the restored profile takes its name from auth metadata'
);

-- === User B: workspace scoping holds across users ==========================

set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}';

select results_eq(
  $$
    select is_new
    from public.complete_onboarding('Hopper Support')
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
  $$ select * from public.complete_onboarding('No Workspace') $$,
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
