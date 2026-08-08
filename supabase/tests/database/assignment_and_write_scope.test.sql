begin;

select plan(9);

-- Two members of one workspace. The guards that validate a row against
-- workspace_members used to run as the invoker, and workspace_members exposes
-- only the caller's own row, so every one of these paths saw an empty result
-- for the *other* member and concluded they were not in the workspace.

insert into auth.users (id, email, raw_user_meta_data)
values
  ('30000000-0000-4000-8000-000000000101', 'ws-owner@example.com',
   '{"full_name":"Scope Owner"}'::jsonb),
  ('30000000-0000-4000-8000-000000000102', 'ws-mate@example.com',
   '{"full_name":"Scope Teammate"}'::jsonb),
  ('30000000-0000-4000-8000-000000000103', 'ws-outsider@example.com',
   '{"full_name":"Scope Outsider"}'::jsonb);

-- Seeded at the test-runner role: authenticated's insert grant on workspaces is
-- a column list that excludes id (20260720090850), and these fixtures need
-- fixed ids. handle_new_workspace reads created_by, so the owner membership is
-- still made for the right user.
insert into public.workspaces (id, name, is_main, created_by)
values ('30000000-0000-4000-8000-000000000201', 'Scope WS', false,
        '30000000-0000-4000-8000-000000000101');

-- on_workspace_created made the owner membership; the teammate joins here.
insert into public.workspace_members (workspace_id, user_id, role)
values (
  '30000000-0000-4000-8000-000000000201',
  '30000000-0000-4000-8000-000000000102',
  'member'
);

insert into public.channels (id, workspace_id, type, name, is_active)
values ('30000000-0000-4000-8000-000000000301',
        '30000000-0000-4000-8000-000000000201', 'telegram', 'TG', true);

insert into public.contacts (id, workspace_id, name, source)
values ('30000000-0000-4000-8000-000000000401',
        '30000000-0000-4000-8000-000000000201', 'Scope Contact', 'telegram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('30000000-0000-4000-8000-000000000501',
        '30000000-0000-4000-8000-000000000201',
        '30000000-0000-4000-8000-000000000401',
        '30000000-0000-4000-8000-000000000301');

-- An inbound message, written the way the webhooks write it.
insert into public.messages (id, workspace_id, conversation_id, direction, type, content)
values ('30000000-0000-4000-8000-000000000601',
        '30000000-0000-4000-8000-000000000201',
        '30000000-0000-4000-8000-000000000501',
        'inbound', 'text', 'Customer says hello');

-- ── Assignment across the roster ─────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"30000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    update public.conversations
    set assigned_to = '30000000-0000-4000-8000-000000000102'
    where id = '30000000-0000-4000-8000-000000000501'
  $$,
  'a member can assign a conversation to a coworker'
);

select is(
  (
    select assigned_to::text
    from public.conversations
    where id = '30000000-0000-4000-8000-000000000501'
  ),
  '30000000-0000-4000-8000-000000000102',
  'the coworker assignment is persisted'
);

select lives_ok(
  $$
    update public.conversations
    set assigned_to = '30000000-0000-4000-8000-000000000101'
    where id = '30000000-0000-4000-8000-000000000501'
  $$,
  'self-assignment still works'
);

select throws_ok(
  $$
    update public.conversations
    set assigned_to = '30000000-0000-4000-8000-000000000103'
    where id = '30000000-0000-4000-8000-000000000501'
  $$,
  '23503',
  'ASSIGNEE_NOT_WORKSPACE_MEMBER',
  'a non-member still cannot be assigned work'
);

-- ── Outbound send, and the retry path that follows it ────────────────────────
select lives_ok(
  $$
    insert into public.messages
      (id, workspace_id, conversation_id, direction, type, content, sender_id, status)
    values ('30000000-0000-4000-8000-000000000602',
            '30000000-0000-4000-8000-000000000201',
            '30000000-0000-4000-8000-000000000501',
            'outbound', 'text', 'Agent replies',
            '30000000-0000-4000-8000-000000000101', 'sent')
  $$,
  'a member can send an outbound message as themselves'
);

select lives_ok(
  $$
    update public.messages
    set status = 'failed'
    where id = '30000000-0000-4000-8000-000000000602'
  $$,
  'the client can still mark a send failed and retry it'
);

-- ── The direction flip that used to unlock everything ────────────────────────
-- The old UPDATE policy matched every row in the workspace and accepted any
-- result whose direction was 'inbound'. Flipping an outbound row to inbound
-- passed the check and also disarmed ensure_message_sender_is_valid, which only
-- inspects outbound rows. direction is no longer a column the client may write.
select throws_ok(
  $$
    update public.messages
    set direction = 'inbound', content = 'Rewritten history'
    where id = '30000000-0000-4000-8000-000000000602'
  $$,
  '42501',
  null,
  'a member cannot flip an outbound message to inbound to rewrite it'
);

select throws_ok(
  $$
    update public.messages
    set external_id = 'wamid.forged', created_at = now() - interval '30 days'
    where id = '30000000-0000-4000-8000-000000000602'
  $$,
  '42501',
  null,
  'a member cannot forge provider identifiers or backdate a message'
);

-- Inbound rows are outside the UPDATE policy entirely, so this matches nothing
-- rather than erroring.
update public.messages
set status = 'read'
where id = '30000000-0000-4000-8000-000000000601';

select is(
  (
    select status
    from public.messages
    where id = '30000000-0000-4000-8000-000000000601'
  ),
  'sent',
  'a member cannot touch an inbound message through the outbound-only policy'
);

reset role;

select * from finish();

rollback;
