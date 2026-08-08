begin;

select plan(27);

-- Archiving replaces a hard delete that could not run. contacts and
-- conversations each carried an admin-only DELETE policy, and both inbound
-- foreign keys are NO ACTION, so the delete succeeded on a contact with no
-- history and raised 23503 on every contact anybody actually wanted gone.
--
-- What is asserted here: an archived row is invisible to member AND admin
-- SELECT, absent from both directory RPCs, present in the one guarded RPC that
-- exists to show it, unreachable by a forged direct update, restorable, and
-- reversed automatically when the customer writes in again. Plus the thing the
-- whole design is for -- that no message was destroyed on the way.
--
-- Fixture numbering avoids every range used by the other files:
--   users …01{01,02}  workspace …0201  channel …0301
--   contacts …04{01,02}  conversations …05{01,02}  messages …06{01,02}

insert into auth.users (id, email, raw_user_meta_data)
values
  ('60000000-0000-4000-8000-000000000101', 'archive-owner@example.com',
   '{"full_name":"Archive Owner"}'::jsonb),
  ('60000000-0000-4000-8000-000000000102', 'archive-member@example.com',
   '{"full_name":"Archive Member"}'::jsonb);

-- Seeded at the test-runner role: authenticated's insert grant on workspaces
-- excludes id (20260720090850) and these fixtures need fixed ids.
insert into public.workspaces (id, name, is_main, created_by)
values ('60000000-0000-4000-8000-000000000201', 'Archive WS', false,
        '60000000-0000-4000-8000-000000000101');

-- on_workspace_created made the owner membership; the member joins here.
insert into public.workspace_members (workspace_id, user_id, role)
values ('60000000-0000-4000-8000-000000000201',
        '60000000-0000-4000-8000-000000000102', 'member');

insert into public.channels (id, workspace_id, type, name, is_active)
values ('60000000-0000-4000-8000-000000000301',
        '60000000-0000-4000-8000-000000000201', 'telegram', 'Archive TG', true);

-- …401 is the contact under test. It carries a phone so the identity matcher
-- has something to find, and a conversation with a message so that the old
-- DELETE policy would have failed on it with 23503.
insert into public.contacts (id, workspace_id, name, phone, email, source)
values
  ('60000000-0000-4000-8000-000000000401',
   '60000000-0000-4000-8000-000000000201', 'Archived Person',
   '+7 999 123-45-67', 'archived@example.com', 'telegram'),
  ('60000000-0000-4000-8000-000000000402',
   '60000000-0000-4000-8000-000000000201', 'Untouched Person',
   null, null, 'telegram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values
  ('60000000-0000-4000-8000-000000000501',
   '60000000-0000-4000-8000-000000000201',
   '60000000-0000-4000-8000-000000000401',
   '60000000-0000-4000-8000-000000000301'),
  ('60000000-0000-4000-8000-000000000502',
   '60000000-0000-4000-8000-000000000201',
   '60000000-0000-4000-8000-000000000402',
   '60000000-0000-4000-8000-000000000301');

insert into public.messages (id, workspace_id, conversation_id, direction, type, content)
values ('60000000-0000-4000-8000-000000000601',
        '60000000-0000-4000-8000-000000000201',
        '60000000-0000-4000-8000-000000000501',
        'inbound', 'text', 'The message the delete would have destroyed');


-- ── Who may archive, and by what route ───────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000102","role":"authenticated"}';

select throws_ok(
  $$ select public.archive_contact('60000000-0000-4000-8000-000000000401') $$,
  '42501',
  null,
  'a plain member cannot archive a contact'
);

-- The forged route. The UPDATE policy repeats deleted_at is null in WITH CHECK
-- precisely so that a member cannot archive by writing the column directly and
-- bypassing the admin guard in the RPC.
select throws_ok(
  $$
    update public.contacts
    set deleted_at = now()
    where id = '60000000-0000-4000-8000-000000000402'
  $$,
  '42501',
  null,
  'archiving cannot be forged through a direct update: WITH CHECK rejects it'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000101","role":"authenticated"}';

-- Hard deletion is now unreachable for the role that used to hold it. Before
-- this change an admin got 23503 here, which read as a bug; now the grant is
-- simply gone.
select throws_ok(
  $$ delete from public.contacts where id = '60000000-0000-4000-8000-000000000401' $$,
  '42501',
  null,
  'an admin can no longer delete a contact: the DELETE grant is revoked'
);

select throws_ok(
  $$ delete from public.conversations where id = '60000000-0000-4000-8000-000000000501' $$,
  '42501',
  null,
  'an admin can no longer delete a conversation either'
);

select lives_ok(
  $$ select public.archive_contact('60000000-0000-4000-8000-000000000401') $$,
  'an owner can archive a contact that has conversations and messages'
);


-- ── What an archived row is invisible to ─────────────────────────────────────

select is(
  (select count(*)::int from public.contacts
   where id = '60000000-0000-4000-8000-000000000401'),
  0,
  'the archived contact is invisible to the admin who archived it -- there is no admin branch in the SELECT policy'
);

select is(
  (select count(*)::int from public.conversations
   where id = '60000000-0000-4000-8000-000000000501'),
  0,
  'its conversation went with it, through the cascade trigger'
);

select is(
  (select count(*)::int from public.contacts
   where id = '60000000-0000-4000-8000-000000000402'),
  1,
  'the other contact in the same workspace is untouched'
);

select is(
  (select count(*)::int from public.conversations
   where id = '60000000-0000-4000-8000-000000000502'),
  1,
  'and so is its conversation: the cascade is scoped to one contact'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000102","role":"authenticated"}';

select is(
  (select count(*)::int from public.contacts
   where id = '60000000-0000-4000-8000-000000000401'),
  0,
  'the archived contact is invisible to a member SELECT'
);

select is(
  (select count(*)::int from public.conversations
   where id = '60000000-0000-4000-8000-000000000501'),
  0,
  'and so is its conversation'
);


-- ── Absent from the RPCs that list them ──────────────────────────────────────
--
-- Neither RPC was edited by this change. Both are SECURITY INVOKER, so they
-- inherit the exclusion from the SELECT policy -- which is the entire reason the
-- filter lives in the policy rather than in each query.

select is(
  (select count(*)::int
   from public.search_workspace_contacts('60000000-0000-4000-8000-000000000201')),
  1,
  'search_workspace_contacts returns only the live contact'
);

select is(
  (select count(*)::int
   from public.match_workspace_contacts(
     '60000000-0000-4000-8000-000000000201',
     array['79991234567'],
     null::text[],
     null::text[]
   )),
  0,
  'match_workspace_contacts does not resurface an archived contact by phone'
);

select throws_ok(
  $$
    select * from public.list_archived_contacts(
      '60000000-0000-4000-8000-000000000201'
    )
  $$,
  '42501',
  null,
  'a member cannot read the archive listing'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000101","role":"authenticated"}';

select is(
  (select count(*)::int
   from public.list_archived_contacts('60000000-0000-4000-8000-000000000201')),
  1,
  'list_archived_contacts is the one guarded hole: an admin sees the archived contact'
);

select is(
  (select conversation_count::int
   from public.list_archived_contacts('60000000-0000-4000-8000-000000000201')),
  1,
  'the archive row reports how many conversations a restore would bring back'
);

select is(
  (select display_name
   from public.list_archived_contacts('60000000-0000-4000-8000-000000000201')),
  'Archived Person',
  'the archive row carries the same display_name the directory computes, so it renders identically'
);


-- ── Nothing was destroyed, and nothing was scrubbed ──────────────────────────
--
-- This is the point of the whole change, so it is asserted rather than assumed.

reset role;

select is(
  (select count(*)::int from public.messages
   where conversation_id = '60000000-0000-4000-8000-000000000501'),
  1,
  'the message history behind the archived conversation is intact'
);

select is(
  (select name || '|' || phone || '|' || email from public.contacts
   where id = '60000000-0000-4000-8000-000000000401'),
  'Archived Person|+7 999 123-45-67|archived@example.com',
  'archiving hides rows and scrubs nothing: name, phone and email are unchanged'
);


-- ── The customer writes in again ─────────────────────────────────────────────
--
-- trg_unarchive_on_inbound_message is BEFORE INSERT, so it is guaranteed to run
-- ahead of trg_create_message_notifications. If that ordering ever breaks, the
-- notification assertion below fails rather than the unarchive one -- the
-- recipient would be alerted about a thread RLS still hides from them.

select lives_ok(
  $$
    insert into public.messages
      (id, workspace_id, conversation_id, direction, type, content)
    values ('60000000-0000-4000-8000-000000000602',
            '60000000-0000-4000-8000-000000000201',
            '60000000-0000-4000-8000-000000000501',
            'inbound', 'text', 'Hello again')
  $$,
  'an inbound message lands on the archived conversation'
);

select is(
  (select deleted_at from public.conversations
   where id = '60000000-0000-4000-8000-000000000501'),
  null,
  'the inbound message unarchived the conversation'
);

select is(
  (select deleted_at from public.contacts
   where id = '60000000-0000-4000-8000-000000000401'),
  null,
  'and its contact, so the two never disagree'
);

select is(
  (select count(*)::int from public.message_notifications
   where message_id = '60000000-0000-4000-8000-000000000602'),
  2,
  'both workspace members were notified -- the unarchive ran before the notification trigger'
);


-- ── Back again ───────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$ select public.archive_contact('60000000-0000-4000-8000-000000000401') $$,
  'the contact can be archived a second time'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000102","role":"authenticated"}';

select throws_ok(
  $$ select public.restore_contact('60000000-0000-4000-8000-000000000401') $$,
  '42501',
  null,
  'a plain member cannot restore either'
);

set local request.jwt.claims =
  '{"sub":"60000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$ select public.restore_contact('60000000-0000-4000-8000-000000000401') $$,
  'an owner restores the contact'
);

select is(
  (select count(*)::int from public.conversations
   where id = '60000000-0000-4000-8000-000000000501'),
  1,
  'restore brings the conversations back with it -- an archive with no way back is just a slower delete'
);

reset role;

select * from finish();

rollback;
