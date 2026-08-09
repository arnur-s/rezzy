begin;

select plan(10);

-- Task 1 covers the columns, the merged-is-archived invariant, the restore
-- refusal, the unarchive-on-inbound-message guard, and what
-- list_archived_contacts reports for a merged row. Tasks 2 and 3 append to
-- this plan count.
--
-- Fixture numbering, 80000000 range, unused elsewhere:
--   users …01{01,02}  workspace …0201  channel …0301
--   contacts …04{01..04}  conversations …05{01,02}  messages …0601

insert into auth.users (id, email, raw_user_meta_data)
values
  ('80000000-0000-4000-8000-000000000101', 'merge-owner@example.com',
   '{"full_name":"Merge Owner"}'::jsonb),
  ('80000000-0000-4000-8000-000000000102', 'merge-member@example.com',
   '{"full_name":"Merge Member"}'::jsonb);

insert into public.workspaces (id, name, is_main, created_by)
values ('80000000-0000-4000-8000-000000000201', 'Merge WS', false,
        '80000000-0000-4000-8000-000000000101');

insert into public.workspace_members (workspace_id, user_id, role)
values ('80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000102', 'member');

insert into public.contacts (id, workspace_id, name, phone, email, source)
values
  ('80000000-0000-4000-8000-000000000401',
   '80000000-0000-4000-8000-000000000201', 'Иван Петров',
   '+7 999 123-45-67', 'ivan@example.com', 'telegram'),
  ('80000000-0000-4000-8000-000000000402',
   '80000000-0000-4000-8000-000000000201', 'Ivan P.',
   '+79991234567', null, 'manual');

-- Used below for the inbound-message trigger test: a channel the merged
-- contact's race-condition conversation can point at.
insert into public.channels (id, workspace_id, type, name, is_active)
values ('80000000-0000-4000-8000-000000000301',
        '80000000-0000-4000-8000-000000000201', 'telegram', 'Merge TG', true);

-- ── The columns exist and carry the intended shape ───────────────────────────

select has_column('public', 'contacts', 'merged_into_id',
  'contacts carries merged_into_id');
select has_column('public', 'contacts', 'merged_at',
  'contacts carries merged_at');
select has_column('public', 'contacts', 'merged_by',
  'contacts carries merged_by');

-- ── merged implies archived ──────────────────────────────────────────────────

select throws_ok(
  $$
    update public.contacts
    set merged_into_id = '80000000-0000-4000-8000-000000000401'
    where id = '80000000-0000-4000-8000-000000000402'
  $$,
  '23514',
  null,
  'a live contact cannot carry merged_into_id'
);

-- Stamped together, the same way merge_contacts will stamp them.
update public.contacts
set deleted_at = now(),
    merged_into_id = '80000000-0000-4000-8000-000000000401',
    merged_at = now(),
    merged_by = '80000000-0000-4000-8000-000000000101'
where id = '80000000-0000-4000-8000-000000000402';

select is(
  (select merged_into_id from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'an archived contact may be marked merged'
);

-- ── an inbound message on a merged contact does not lose the message ────────
--
-- The conversation is created after the merge stamp above, so
-- trg_cascade_contact_archive never touched it: it is live, exactly like the
-- race merge_contacts (Task 2) cannot fully close -- a conversation created by
-- a concurrent resolve_*_conversation between the repoint and the archive
-- stamp. unarchive_on_inbound_message() sees an archived contact and, before
-- the merged_into_id guard, would try to clear its deleted_at and hit
-- contacts_merged_is_archived_check -- a 23514 inside a BEFORE INSERT trigger,
-- which aborts the whole message insert.

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('80000000-0000-4000-8000-000000000501',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000402',
        '80000000-0000-4000-8000-000000000301');

select lives_ok(
  $$
    insert into public.messages
      (id, workspace_id, conversation_id, direction, type, content)
    values ('80000000-0000-4000-8000-000000000601',
            '80000000-0000-4000-8000-000000000201',
            '80000000-0000-4000-8000-000000000501',
            'inbound', 'text', 'Message after the merge')
  $$,
  'an inbound message on a merged contact''s conversation does not abort the insert'
);

select is(
  (select deleted_at is not null from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  true,
  'the merged contact stays archived -- the trigger does not unarchive a merged shell'
);

-- ── restore refuses a merged contact ─────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$ select public.restore_contact('80000000-0000-4000-8000-000000000402') $$,
  'P0001',
  'CONTACT_IS_MERGED',
  'restore_contact refuses a merged contact rather than writing a row that violates the check'
);

-- ── list_archived_contacts says who a merged row was merged into ────────────
--
-- Still under the owner claims set above: the RPC is owner/admin only.

select is(
  (select merged_into_id from public.list_archived_contacts(
    '80000000-0000-4000-8000-000000000201'
  ) where id = '80000000-0000-4000-8000-000000000402'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'list_archived_contacts reports which contact a merged row was merged into'
);

select is(
  (select merged_into_name from public.list_archived_contacts(
    '80000000-0000-4000-8000-000000000201'
  ) where id = '80000000-0000-4000-8000-000000000402'),
  'Иван Петров',
  'and the survivor''s display name, computed the same way search_workspace_contacts computes it'
);

select * from finish();
rollback;
