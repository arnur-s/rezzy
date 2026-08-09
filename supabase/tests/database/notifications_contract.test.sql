begin;

select plan(36);

-- =============================================================================
-- Seed: a workspace with two members (A, B), an outsider (C) who is never a
-- member, and a fourth member (D) who is later removed from the workspace
-- after being assigned a conversation. All structural seeding runs as the
-- unrestricted test-runner role (mirrors security_contract.test.sql), so RLS
-- and grants are only exercised in the dedicated sections below.
-- =============================================================================

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'notif-agent-a@example.com',
    '{"full_name":"Agent A"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'notif-agent-b@example.com',
    '{"full_name":"Agent B"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000103',
    'notif-outsider-c@example.com',
    '{"full_name":"Outsider C"}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000104',
    'notif-agent-d@example.com',
    '{"full_name":"Agent D"}'::jsonb
  );

insert into public.workspaces (id, name, description, is_main, created_by)
values (
  '10000000-0000-4000-8000-000000000201',
  'Notifications contract workspace',
  'Created by the pgTAP notifications contract',
  false,
  '10000000-0000-4000-8000-000000000101'
);

-- A's owner membership is created automatically by the on_workspace_created
-- trigger (handle_new_workspace). D is added later, immediately before the
-- membership-removal scenario, so the workspace has exactly {A, B} as members
-- while the assertions below are checked.
insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000102',
  'member'
);

insert into public.channels (id, workspace_id, type, name)
values (
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000201',
  'telegram',
  'Notifications contract channel'
);

-- conversations has a unique (contact_id, channel_id) constraint, so each
-- conversation below gets its own contact on the shared channel.
insert into public.contacts (id, workspace_id, name, source)
values
  (
    '10000000-0000-4000-8000-000000000401',
    '10000000-0000-4000-8000-000000000201',
    'Notifications contract contact (unassigned)',
    'telegram'
  ),
  (
    '10000000-0000-4000-8000-000000000402',
    '10000000-0000-4000-8000-000000000201',
    'Notifications contract contact (assigned to A)',
    'telegram'
  ),
  (
    '10000000-0000-4000-8000-000000000403',
    '10000000-0000-4000-8000-000000000201',
    'Notifications contract contact (outbound)',
    'telegram'
  ),
  (
    '10000000-0000-4000-8000-000000000404',
    '10000000-0000-4000-8000-000000000201',
    'Notifications contract contact (assigned to D)',
    'telegram'
  );

-- Unassigned conversation -> every current workspace member is eligible.
insert into public.conversations (id, workspace_id, contact_id, channel_id, assigned_to)
values (
  '10000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000401',
  '10000000-0000-4000-8000-000000000301',
  null
);

-- Assigned conversation -> only the assignee (A) is eligible.
insert into public.conversations (id, workspace_id, contact_id, channel_id, assigned_to)
values (
  '10000000-0000-4000-8000-000000000502',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000402',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000101'
);

-- Dedicated conversation for the outbound-message test, kept isolated so the
-- auto-assign-on-outbound and outbound triggers cannot mutate the state the
-- other assertions depend on.
insert into public.conversations (id, workspace_id, contact_id, channel_id, assigned_to)
values (
  '10000000-0000-4000-8000-000000000504',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000403',
  '10000000-0000-4000-8000-000000000301',
  null
);

-- =============================================================================
-- Recipient resolution: unassigned conversation notifies every member.
-- =============================================================================

insert into public.messages (
  id, workspace_id, conversation_id, direction, type, content, sender_id, status
)
values (
  '10000000-0000-4000-8000-000000000601',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000501',
  'inbound',
  'text',
  'Hello, is anyone there?',
  null,
  'delivered'
);

select results_eq(
  $$
    select recipient_id::text
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000601'
    order by recipient_id
  $$,
  $$
    values
      ('10000000-0000-4000-8000-000000000101'),
      ('10000000-0000-4000-8000-000000000102')
  $$,
  'unassigned conversation notifies every current workspace member, and only members'
);

-- =============================================================================
-- Recipient resolution: assigned conversation notifies only the assignee.
-- =============================================================================

insert into public.messages (
  id, workspace_id, conversation_id, direction, type, content, sender_id, status
)
values (
  '10000000-0000-4000-8000-000000000602',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000502',
  'inbound',
  'text',
  'Follow-up on my order',
  null,
  'delivered'
);

select results_eq(
  $$
    select recipient_id::text
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000602'
  $$,
  $$ values ('10000000-0000-4000-8000-000000000101') $$,
  'assigned conversation notifies only the assigned agent, not other members'
);

-- =============================================================================
-- Outbound messages never create notification recipients.
-- =============================================================================

insert into public.messages (
  id, workspace_id, conversation_id, direction, type, content, sender_id, status
)
values (
  '10000000-0000-4000-8000-000000000603',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000504',
  'outbound',
  'text',
  'Thanks for reaching out!',
  '10000000-0000-4000-8000-000000000101',
  'sent'
);

select is(
  (
    select count(*)::int
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000603'
  ),
  0,
  'outbound messages do not create notification recipients'
);

-- =============================================================================
-- Idempotency: the unique (message_id, recipient_id) constraint prevents
-- duplicate recipient records, and the trigger's own ON CONFLICT DO NOTHING
-- clause absorbs re-processing without erroring or duplicating rows.
-- =============================================================================

select is(
  (
    select count(*)::int
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000601'
  ),
  2,
  'exactly one recipient record is created per eligible member (no duplicates)'
);

select throws_ok(
  $$
    insert into public.message_notifications (
      workspace_id, conversation_id, message_id, recipient_id
    )
    values (
      '10000000-0000-4000-8000-000000000201',
      '10000000-0000-4000-8000-000000000501',
      '10000000-0000-4000-8000-000000000601',
      '10000000-0000-4000-8000-000000000101'
    )
  $$,
  '23505',
  NULL,
  'the unique (message_id, recipient_id) constraint rejects a raw duplicate insert'
);

-- Re-run the exact insert/select the trigger uses for the same message: proves
-- the ON CONFLICT DO NOTHING guard is idempotent under retry/re-processing.
insert into public.message_notifications (
  workspace_id, conversation_id, message_id, recipient_id
)
select
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000501',
  '10000000-0000-4000-8000-000000000601',
  wm.user_id
from public.workspace_members wm
where wm.workspace_id = '10000000-0000-4000-8000-000000000201'
on conflict (message_id, recipient_id) do nothing;

select is(
  (
    select count(*)::int
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000601'
  ),
  2,
  'retried recipient resolution does not create duplicate records'
);

-- =============================================================================
-- Workspace membership enforcement: an assignee removed from the workspace is
-- excluded from future notifications (assignment is not retroactively
-- reassigned to other members).
-- =============================================================================

-- D joins the workspace and immediately receives an assigned conversation.
insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000104',
  'member'
);

insert into public.conversations (id, workspace_id, contact_id, channel_id, assigned_to)
values (
  '10000000-0000-4000-8000-000000000503',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000404',
  '10000000-0000-4000-8000-000000000301',
  '10000000-0000-4000-8000-000000000104'
);

insert into public.messages (
  id, workspace_id, conversation_id, direction, type, content, sender_id, status
)
values (
  '10000000-0000-4000-8000-000000000604',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000503',
  'inbound',
  'text',
  'Still assigned to D',
  null,
  'delivered'
);

select results_eq(
  $$
    select recipient_id::text
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000604'
  $$,
  $$ values ('10000000-0000-4000-8000-000000000104') $$,
  'the assignee is notified while still a workspace member'
);

delete from public.workspace_members
where workspace_id = '10000000-0000-4000-8000-000000000201'
  and user_id = '10000000-0000-4000-8000-000000000104';

-- Removal clears the assignment (trg_clear_assignments_for_removed_member).
-- Before that trigger existed, assigned_to still pointed at D, and
-- create_message_notifications routes an assigned conversation to the assignee
-- alone: the notification went to somebody with no seat, and the members who
-- were still there heard nothing. A thread going quiet is the worst outcome
-- available here, so removal returns the conversation to unassigned.
select is(
  (
    select assigned_to
    from public.conversations
    where id = '10000000-0000-4000-8000-000000000503'
  ),
  null,
  'removing a member clears the conversations they were assigned'
);

insert into public.messages (
  id, workspace_id, conversation_id, direction, type, content, sender_id, status
)
values (
  '10000000-0000-4000-8000-000000000605',
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000503',
  'inbound',
  'text',
  'D was removed from the workspace',
  null,
  'delivered'
);

select bag_eq(
  $$
    select recipient_id::text
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000605'
  $$,
  $$
    values
      ('10000000-0000-4000-8000-000000000101'),
      ('10000000-0000-4000-8000-000000000102')
  $$,
  'the thread falls back to the remaining roster instead of notifying nobody'
);

-- Both message_notifications policies used to be `recipient_id = auth.uid()`
-- and nothing else -- the one table in the message graph that does not
-- authorise through is_workspace_member(). D kept reading the conversation ids,
-- message ids and arrival times of a workspace they had been removed from.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000104","role":"authenticated"}';

select is_empty(
  $$ select id from public.message_notifications $$,
  'a removed member reads no notification rows for the workspace they left'
);

reset role;

-- Withdrawn, not destroyed. 20260809120000 chose the policy predicate over
-- deleting the rows on removal, so read state survives and a re-add is
-- reversible -- see its header for why.
select is(
  (
    select count(*)::int
    from public.message_notifications
    where recipient_id = '10000000-0000-4000-8000-000000000104'
  ),
  1,
  'the row itself survives the removal rather than being deleted'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000104',
  'member'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000104","role":"authenticated"}';

select is(
  (select count(*)::int from public.message_notifications),
  1,
  'and a re-added member gets their notification history back'
);

reset role;

-- =============================================================================
-- RLS: message_notifications. Recipients see only their own rows and cannot
-- create or delete records directly.
-- =============================================================================

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}';

select results_eq(
  $$
    select recipient_id::text
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000601'
  $$,
  $$ values ('10000000-0000-4000-8000-000000000101') $$,
  'a recipient sees only their own notification row, not other members'' rows'
);

select throws_ok(
  $$
    insert into public.message_notifications (
      workspace_id, conversation_id, message_id, recipient_id
    )
    values (
      '10000000-0000-4000-8000-000000000201',
      '10000000-0000-4000-8000-000000000501',
      '10000000-0000-4000-8000-000000000601',
      '10000000-0000-4000-8000-000000000101'
    )
  $$,
  '42501',
  NULL,
  'authenticated users cannot create a notification record for themselves directly'
);

select throws_ok(
  $$
    insert into public.message_notifications (
      workspace_id, conversation_id, message_id, recipient_id
    )
    values (
      '10000000-0000-4000-8000-000000000201',
      '10000000-0000-4000-8000-000000000502',
      '10000000-0000-4000-8000-000000000602',
      '10000000-0000-4000-8000-000000000102'
    )
  $$,
  '42501',
  NULL,
  'authenticated users cannot create a notification record for another user'
);

select lives_ok(
  $$
    update public.message_notifications
    set read_at = now()
    where message_id = '10000000-0000-4000-8000-000000000601'
      and recipient_id = '10000000-0000-4000-8000-000000000101'
  $$,
  'a recipient can mark their own notification read'
);

select throws_ok(
  $$
    update public.message_notifications
    set recipient_id = '10000000-0000-4000-8000-000000000101'
    where message_id = '10000000-0000-4000-8000-000000000601'
      and recipient_id = '10000000-0000-4000-8000-000000000101'
  $$,
  '42501',
  NULL,
  'authenticated users cannot update columns other than read_at'
);

-- Attempt to mark B's row read while authenticated as A: RLS filters the row
-- out of the UPDATE entirely (0 rows affected, not an error).
update public.message_notifications
set read_at = now()
where message_id = '10000000-0000-4000-8000-000000000601'
  and recipient_id = '10000000-0000-4000-8000-000000000102';

reset role;

select is(
  (
    select read_at
    from public.message_notifications
    where message_id = '10000000-0000-4000-8000-000000000601'
      and recipient_id = '10000000-0000-4000-8000-000000000102'
  ),
  null::timestamptz,
  'a recipient cannot mark another user''s notification as read'
);

-- =============================================================================
-- RLS: notification_preferences. Users manage only their own row.
-- =============================================================================

insert into public.notification_preferences (user_id, desktop_enabled)
values ('10000000-0000-4000-8000-000000000102', true);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.notification_preferences (user_id, sound_enabled)
    values ('10000000-0000-4000-8000-000000000101', true)
  $$,
  'a user can create their own notification preferences row'
);

select is(
  (
    select count(*)::int
    from public.notification_preferences
    where user_id = '10000000-0000-4000-8000-000000000102'
  ),
  0,
  'a user cannot see another user''s notification preferences'
);

select throws_ok(
  $$
    insert into public.notification_preferences (user_id)
    values ('10000000-0000-4000-8000-000000000102')
  $$,
  '42501',
  NULL,
  'a user cannot create notification preferences for another user'
);

reset role;

-- =============================================================================
-- push_subscriptions. Registration goes through public.upsert_push_subscription
-- (20260809090100); reading and sign-out deletion stay on the table's own RLS.
-- =============================================================================

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (
  '10000000-0000-4000-8000-000000000102',
  'https://push.example.com/b-endpoint',
  'b-p256dh',
  'b-auth'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    select public.upsert_push_subscription(
      'https://push.example.com/a-endpoint',
      'a-p256dh',
      'a-auth',
      'Test Agent A'
    )
  $$,
  'a user can register their own push subscription'
);

-- The RPC is the only write path left. The INSERT grant and policy went with
-- 20260809090100, so a direct write is refused before RLS is consulted.
select throws_ok(
  $$
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (
      '10000000-0000-4000-8000-000000000101',
      'https://push.example.com/a-direct-endpoint',
      'a-p256dh',
      'a-auth'
    )
  $$,
  '42501',
  NULL,
  'a user cannot write push_subscriptions directly'
);

select is(
  (
    select count(*)::int
    from public.push_subscriptions
    where user_id = '10000000-0000-4000-8000-000000000102'
  ),
  0,
  'a user cannot see another user''s push subscriptions'
);

-- RLS filters out rows the caller does not own, so this silently deletes zero
-- rows rather than raising an error. Verified below after switching back to
-- an unrestricted role.
delete from public.push_subscriptions
where user_id = '10000000-0000-4000-8000-000000000102';

reset role;

select is(
  (
    select count(*)::int
    from public.push_subscriptions
    where user_id = '10000000-0000-4000-8000-000000000102'
  ),
  1,
  'a user cannot delete another user''s push subscription'
);

-- ---------------------------------------------------------------------------
-- Shared device: B signs in where A had already registered this browser. The
-- endpoint is one physical notification channel, so it moves to B outright --
-- otherwise A keeps receiving message previews on a device signed in as B.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000102","role":"authenticated"}';

select lives_ok(
  $$
    select public.upsert_push_subscription(
      'https://push.example.com/a-endpoint',
      'b-p256dh',
      'b-auth',
      'Test Agent B'
    )
  $$,
  'registering an endpoint another user holds succeeds instead of failing'
);

reset role;

select is(
  (
    select user_id
    from public.push_subscriptions
    where endpoint = 'https://push.example.com/a-endpoint'
  ),
  '10000000-0000-4000-8000-000000000102'::uuid,
  'the second user owns the transferred endpoint'
);

select is(
  (
    select count(*)::int
    from public.push_subscriptions
    where user_id = '10000000-0000-4000-8000-000000000101'
  ),
  0,
  'the first user keeps no subscription for a transferred endpoint'
);

-- A's sign-out deletes by endpoint under A's own RLS. Once the endpoint has
-- moved, that must remove nothing rather than unsubscribing its new owner.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}';

delete from public.push_subscriptions
where endpoint = 'https://push.example.com/a-endpoint';

reset role;

select is(
  (
    select count(*)::int
    from public.push_subscriptions
    where endpoint = 'https://push.example.com/a-endpoint'
  ),
  1,
  'a stale sign-out does not remove the endpoint''s new owner'
);

-- Re-registering an endpoint you already hold refreshes it in place.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000102","role":"authenticated"}';

select public.upsert_push_subscription(
  'https://push.example.com/b-endpoint',
  'b-p256dh-rotated',
  'b-auth-rotated',
  'Test Agent B'
);

reset role;

select results_eq(
  $$
    select count(*)::int, max(p256dh)
    from public.push_subscriptions
    where endpoint = 'https://push.example.com/b-endpoint'
  $$,
  $$ values (1, 'b-p256dh-rotated') $$,
  're-registering your own endpoint refreshes the one row rather than adding another'
);

-- Sign-out by the current owner still removes the subscription.
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000102","role":"authenticated"}';

delete from public.push_subscriptions
where endpoint = 'https://push.example.com/a-endpoint';

reset role;

select is(
  (
    select count(*)::int
    from public.push_subscriptions
    where endpoint = 'https://push.example.com/a-endpoint'
  ),
  0,
  'sign-out removes the caller''s own push subscription'
);

-- =============================================================================
-- get_workspace_unread_counts: per-agent, derived from each user's own read
-- cursor. One agent reading a conversation must not affect another agent's
-- unread count.
-- =============================================================================

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}';

-- A has never read the assigned conversation: the one inbound message counts.
select results_eq(
  $$
    select unread_count
    from public.get_workspace_unread_counts('10000000-0000-4000-8000-000000000201')
    where conversation_id = '10000000-0000-4000-8000-000000000502'
  $$,
  $$ values (1) $$,
  'unread count reflects inbound messages before the caller has a read cursor'
);

select lives_ok(
  $$ select public.mark_conversation_read('10000000-0000-4000-8000-000000000502') $$,
  'mark_conversation_read succeeds for the assigned agent'
);

select results_eq(
  $$
    select unread_count
    from public.get_workspace_unread_counts('10000000-0000-4000-8000-000000000201')
    where conversation_id = '10000000-0000-4000-8000-000000000502'
  $$,
  $$ values (0) $$,
  'unread count drops to zero for the agent who just read the conversation'
);

reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000102","role":"authenticated"}';

-- B never read the conversation and was never notified for it (it was
-- assigned to A), but the unread helper still reports it accurately from B's
-- own (unset) cursor -- proving A's read did not clear B's unread state.
select results_eq(
  $$
    select unread_count
    from public.get_workspace_unread_counts('10000000-0000-4000-8000-000000000201')
    where conversation_id = '10000000-0000-4000-8000-000000000502'
  $$,
  $$ values (1) $$,
  'another agent''s unread count for the same conversation is unaffected'
);

reset role;

-- =============================================================================
-- Soft delete withdraws the notification rows with the rest of the workspace.
-- The same predicate covers this case, which a delete-on-removal trigger could
-- not have: memberships are retained across a soft delete on purpose, so there
-- is no removal to hang one on.
-- =============================================================================

set local request.jwt.claims =
  '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated"}';

select public.soft_delete_workspace('10000000-0000-4000-8000-000000000201');

set local role authenticated;

select is_empty(
  $$ select id from public.message_notifications $$,
  'a member of a soft-deleted workspace reads none of its notification rows'
);

reset role;

select * from finish();

rollback;
