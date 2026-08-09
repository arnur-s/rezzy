begin;

select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('60000000-0000-4000-8000-000000000001', 'mm-owner@example.com',
   '{"full_name":"MM Owner"}'::jsonb),
  ('60000000-0000-4000-8000-000000000002', 'mm-admin@example.com',
   '{"full_name":"MM Admin"}'::jsonb);

insert into public.workspaces (id, name, created_by)
values ('60000000-0000-4000-8000-000000000101', 'MM Workspace',
        '60000000-0000-4000-8000-000000000001');
-- on_workspace_created seated user 001 as owner.

insert into public.workspace_members (workspace_id, user_id, role)
values ('60000000-0000-4000-8000-000000000101',
        '60000000-0000-4000-8000-000000000002', 'admin');

-- ── The role helper ──────────────────────────────────────────────────────────
--
-- private.workspace_role holds no grant to authenticated -- it is internal
-- authorization infrastructure reached only from inside definer functions
-- that run as their owner (see the migration header). So this is called at
-- the ambient (superuser) role rather than under "set local role
-- authenticated": that role switch is reserved below for assertions that
-- exercise what the client role can actually do. auth.uid() only reads the
-- request.jwt.claims GUC, not the current role, so the caller identity is
-- still exercised correctly here.

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  private.workspace_role('60000000-0000-4000-8000-000000000101'),
  'admin',
  'workspace_role returns the caller''s role in a live workspace'
);

-- Pin the no-client-caller property itself, not just its side effect above.
-- The previous assertion only shows what the function returns when reached at
-- an elevated role; it says nothing about whether authenticated could reach
-- it at all. Assert both halves of that directly -- schema USAGE and function
-- EXECUTE -- so a future migration that re-grants either on `private` fails
-- this test instead of passing green while quietly reopening the escalation
-- this task closes.
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage')
  and not has_function_privilege(
    'authenticated', 'private.workspace_role(uuid)', 'execute'
  ),
  'authenticated cannot reach private.workspace_role at all'
);

-- ── The creator escalation is closed ─────────────────────────────────────────
--
-- The creator is removed from their own workspace, then tries the insert the
-- old policy admitted: role = 'owner' on a workspace they created.

delete from public.workspace_members
where workspace_id = '60000000-0000-4000-8000-000000000101'
  and user_id = '60000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('60000000-0000-4000-8000-000000000101',
            '60000000-0000-4000-8000-000000000001', 'owner')
  $$,
  '42501',
  null,
  'a removed creator cannot re-insert themselves as owner'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.workspace_members', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'delete'),
  'authenticated holds select only on workspace_members'
);

-- ── viewer is gone ───────────────────────────────────────────────────────────

select throws_ok(
  $$
    insert into public.workspace_members (workspace_id, user_id, role)
    values ('60000000-0000-4000-8000-000000000101',
            '60000000-0000-4000-8000-000000000002', 'viewer')
  $$,
  '23514',
  null,
  'viewer is no longer an accepted role'
);

select * from finish();

rollback;
