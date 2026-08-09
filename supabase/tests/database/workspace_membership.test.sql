begin;

select plan(30);

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

-- ── The ghost workspace is gone ──────────────────────────────────────────────
--
-- The creator was removed from the roster above. Without the create_workspace
-- RPC dropping the created_by branch from the workspaces SELECT policy, they
-- would still be able to read the workspace row itself even though they can no
-- longer read anything inside it.

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$
    select id from public.workspaces
    where id = '60000000-0000-4000-8000-000000000101'
  $$,
  'a removed creator no longer reads the workspace they created'
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

-- ── Workspace creation moved behind an RPC ───────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select ok(
  not has_table_privilege('authenticated', 'public.workspaces', 'insert'),
  'authenticated can no longer insert workspaces directly'
);

select is(
  (select name from public.create_workspace('RPC Made', null, 'briefcase', false)),
  'RPC Made',
  'create_workspace returns the row it created'
);

select is(
  (
    select wm.role
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.name = 'RPC Made'
      and wm.user_id = '60000000-0000-4000-8000-000000000002'
  ),
  'owner',
  'the trigger seated the caller as owner inside the RPC'
);

reset role;

-- ── The invitations table ────────────────────────────────────────────────────

select ok(
  has_table_privilege('authenticated', 'public.workspace_invitations', 'select')
  and not has_table_privilege('authenticated', 'public.workspace_invitations', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_invitations', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_invitations', 'delete'),
  'authenticated may read invitations and write none'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.workspace_invitations'::regclass
  ),
  'RLS is enabled on workspace_invitations'
);

-- Realtime cannot deliver an event for a table outside the publication, and the
-- invitee's notification depends on it.
select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_invitations'
  ),
  'workspace_invitations is in the supabase_realtime publication'
);

-- ── Inviting ─────────────────────────────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-4000-8000-000000000003', 'mm-invitee@example.com',
        '{"full_name":"MM Invitee"}'::jsonb);

-- The "creator escalation" block above removed the owner (001) from
-- workspace_members entirely, so the ALREADY_A_MEMBER case below has nobody
-- to collide with otherwise: the only remaining member is 002, the actor
-- itself, which would exercise CANNOT_INVITE_SELF instead. Reseat 001 as an
-- ordinary member -- the role value is irrelevant to the check, only
-- membership existence is.
insert into public.workspace_members (workspace_id, user_id, role)
values ('60000000-0000-4000-8000-000000000101',
        '60000000-0000-4000-8000-000000000001', 'member');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'nobody@example.com', 'member')
  $$,
  'P0002',
  'USER_NOT_FOUND',
  'inviting an address no user holds is refused'
);

select is(
  (select count(*)::int from public.workspace_invitations),
  0,
  'and writes nothing'
);

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'MM-Owner@Example.com ', 'member')
  $$,
  '42710',
  'ALREADY_A_MEMBER',
  'inviting an existing member is refused, and the lookup is case- and space-insensitive'
);

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'mm-admin@example.com', 'member')
  $$,
  '22023',
  'CANNOT_INVITE_SELF',
  'inviting yourself is refused'
);

select throws_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'owner')
  $$,
  '22023',
  'INVALID_ROLE',
  'an invitation cannot grant owner'
);

select lives_ok(
  $$
    select public.invite_workspace_member(
      '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'member')
  $$,
  'an admin can invite an existing user'
);

-- Re-invite: same row, new role, no second pending invitation, no 23505.
select public.invite_workspace_member(
  '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'admin');

-- Reset role before reading workspace_invitations directly: its RLS policy
-- scopes SELECT to invited_user_id = auth.uid(), so the inviting admin's own
-- session sees none of the rows it just wrote (they are addressed to the
-- invitee, 003, not to the admin, 002). The client never queries this table
-- directly either way -- list_workspace_invitations is definer and bypasses
-- RLS -- so this assertion reads at the ambient role, same as the earlier
-- privilege and RLS checks above.
reset role;

select results_eq(
  $$
    select count(*)::int, max(role)
    from public.workspace_invitations
    where status = 'pending'
  $$,
  $$ values (1, 'admin') $$,
  're-inviting updates the pending row rather than creating a second'
);

-- ── list_workspace_invitations is owner/admin only ──────────────────────────
--
-- It returns email addresses, which list_workspace_members deliberately
-- withholds from colleagues (20260731183000). User 001 is a plain member of
-- workspace 101 (reseated above) -- exactly the caller this gate exists to
-- stop from harvesting invitee addresses.

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select * from public.list_workspace_invitations(
      '60000000-0000-4000-8000-000000000101')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a plain member cannot list workspace invitations'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq(
  $$
    select invited_email, invited_name, role, invited_by_name
    from public.list_workspace_invitations(
      '60000000-0000-4000-8000-000000000101')
  $$,
  $$
    values (
      'mm-invitee@example.com'::text, 'MM Invitee'::text, 'admin'::text,
      'MM Admin'::text
    )
  $$,
  'an admin sees the pending invitation with its address and names'
);

reset role;

-- ── list_my_workspace_invitations is the invitee's own view ────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}';

select results_eq(
  $$
    select workspace_name, role
    from public.list_my_workspace_invitations()
  $$,
  $$ values ('MM Workspace'::text, 'admin'::text) $$,
  'the invitee sees their own pending invitation'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select * from public.list_my_workspace_invitations() $$,
  'a user with no invitations sees none'
);

reset role;

-- ── Revoking ─────────────────────────────────────────────────────────────────
--
-- Captured at the ambient role: workspace_invitations RLS scopes SELECT to
-- invited_user_id = auth.uid(), so the admin who is about to revoke this row
-- could not read it directly, even though the definer RPC can act on it. A
-- temporary table is the established handoff for a value one assertion needs
-- and another produced -- see contact_notes.test.sql.
create temporary table mm_pending_invitation as
select id
from public.workspace_invitations
where workspace_id = '60000000-0000-4000-8000-000000000101'
  and invited_user_id = '60000000-0000-4000-8000-000000000003'
  and status = 'pending';
grant select on mm_pending_invitation to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$
    select public.revoke_workspace_invitation(
      (select id from mm_pending_invitation))
  $$,
  'an admin can revoke a pending invitation'
);

reset role;

-- Both halves of workspace_invitations_resolved_at_check, not just status:
-- a revoke that forgot resolved_at would violate the constraint and raise
-- rather than silently pass, but that only proves the constraint exists, not
-- that this function sets both. Assert the end state directly.
select results_eq(
  $$
    select status, (resolved_at is not null)
    from public.workspace_invitations
    where id = (select id from mm_pending_invitation)
  $$,
  $$ values ('revoked'::text, true) $$,
  'revoke flips status and resolved_at together'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select throws_ok(
  $$
    select public.revoke_workspace_invitation(
      (select id from mm_pending_invitation))
  $$,
  'P0002',
  'INVITATION_NOT_FOUND',
  'revoking an already-resolved invitation is refused'
);

reset role;

-- ── Responding ───────────────────────────────────────────────────────────────
--
-- The Revoking block above resolved the only pending invitation this fixture
-- had (the same row created at "an admin can invite an existing user" and
-- re-invited to 'admin'): it is now status = 'revoked', not 'pending'. Seed a
-- fresh pending invitation for the invitee to accept.

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select public.invite_workspace_member(
  '60000000-0000-4000-8000-000000000101', 'mm-invitee@example.com', 'admin');

reset role;

-- Captured at the ambient role for the same reason as mm_pending_invitation
-- above: workspace_invitations RLS scopes SELECT to invited_user_id =
-- auth.uid(). Resolving "the pending invitation" inline under a caller other
-- than the invitee (003) would see zero rows under RLS and pass the throws_ok
-- below for the wrong reason -- a NULL id fed to the RPC, not an authorization
-- mismatch it actually caught.
create temporary table mm_new_invitation as
select id
from public.workspace_invitations
where workspace_id = '60000000-0000-4000-8000-000000000101'
  and invited_user_id = '60000000-0000-4000-8000-000000000003'
  and status = 'pending';
grant select on mm_new_invitation to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$
    select public.respond_to_workspace_invitation(
      (select id from mm_new_invitation),
      true)
  $$,
  'P0002',
  'INVITATION_NOT_FOUND',
  'somebody who is not the invitee cannot accept the invitation'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated"}';

select lives_ok(
  $$
    select public.respond_to_workspace_invitation(
      (select id from mm_new_invitation),
      true)
  $$,
  'the invitee accepts'
);

reset role;

select results_eq(
  $$
    select wm.role, wm.invited_by
    from public.workspace_members wm
    where wm.workspace_id = '60000000-0000-4000-8000-000000000101'
      and wm.user_id = '60000000-0000-4000-8000-000000000003'
  $$,
  $$ values ('admin', '60000000-0000-4000-8000-000000000002'::uuid) $$,
  'acceptance seats them at the invited role, carrying invited_by'
);

select results_eq(
  $$
    select status, resolved_by
    from public.workspace_invitations
    where id = (select id from mm_new_invitation)
  $$,
  $$ values ('accepted', '60000000-0000-4000-8000-000000000003'::uuid) $$,
  'and stamps the invitation'
);

select * from finish();

rollback;
