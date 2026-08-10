begin;

select plan(40);

-- Task 1 covers the columns, the merged-is-archived invariant, the restore
-- refusal, the unarchive-on-inbound-message guard, and what
-- list_archived_contacts reports for a merged row. Task 2 appends the
-- merge_contacts assertions below. Task 3 appends to this plan count in turn.
--
-- Fixture numbering, 80000000 range, unused elsewhere:
--   users …01{01,02}  workspace …0201  channels …03{01,02}
--   contacts …04{01..04}  conversations …05{01..04}  messages …0601
--   channel identity …0701  note …0801

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

-- ═══════════════════════════════════════════════════════════════════════════
-- Task 2: merge_contacts
-- ═══════════════════════════════════════════════════════════════════════════

reset role;

-- Undo the Task 1 fixture merge so …401 and …402 are two live contacts again,
-- and repoint conversation …501 back onto …401. Task 1's inbound-message test
-- created …501 under …402 (the loser here) after stamping the merge, to prove
-- an inbound message on it does not lose the write, so it is left pointing at
-- the wrong contact for this fixture: …501 is meant to be the survivor's own
-- telegram thread. The message already sitting on it (…601) needs no changes
-- -- its content plays no part in any assertion below.
update public.contacts
set deleted_at = null, merged_into_id = null, merged_at = null, merged_by = null
where id = '80000000-0000-4000-8000-000000000402';

update public.conversations
set contact_id = '80000000-0000-4000-8000-000000000401'
where id = '80000000-0000-4000-8000-000000000501';

-- Channel …301 (telegram) and conversation …501 (now repointed to …401)
-- already exist from Task 1's fixture; only the whatsapp channel is new here.
insert into public.channels (id, workspace_id, type, name, is_active)
values
  ('80000000-0000-4000-8000-000000000302',
   '80000000-0000-4000-8000-000000000201', 'whatsapp', 'Merge WA', true);

-- …402 the loser: a whatsapp thread, a shared number spelled differently, a
-- number the survivor does not have, a channel identity, and a note.
insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('80000000-0000-4000-8000-000000000502',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000402',
        '80000000-0000-4000-8000-000000000302');

insert into public.contact_phones (workspace_id, contact_id, phone, position)
values
  ('80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000401', '+7 999 123-45-67', 0),
  -- A genuine second position-0 number, distinct digits, so it moves rather
  -- than collapses: after the repoint the survivor holds two rows both
  -- claiming position 0, which is the real collision the renumbering step (and
  -- the ranking fix it needed) exists to resolve. This row's created_at ties
  -- the survivor's own -- every row this fixture writes shares one
  -- transaction timestamp -- so without that ranking fix, which one lands on
  -- position 0 would come down to a coin-flip on contact_phones.id.
  ('80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000402', '+7 916 000-11-22', 0),
  -- Same digits as the survivor's, spelled differently: must collapse, not 23505.
  ('80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000402', '+79991234567', 1);

insert into public.contact_channels
  (id, contact_id, workspace_id, channel_id, channel_type, external_id, external_name)
values ('80000000-0000-4000-8000-000000000701',
        '80000000-0000-4000-8000-000000000402',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000302',
        'whatsapp', '79991234567', 'Ivan P.');

insert into public.contact_notes (id, workspace_id, contact_id, body)
values ('80000000-0000-4000-8000-000000000801',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000402',
        'note that must survive the merge');

set local role authenticated;

-- ── Authority ────────────────────────────────────────────────────────────────

set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000102","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a plain member cannot merge contacts'
);

set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000401')
  $$,
  '22023',
  'CONTACT_MERGE_SAME_CONTACT',
  'a contact cannot be merged into itself'
);

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-0000000004ff')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a contact that does not exist is refused exactly like one the caller may not touch'
);

-- ── Field validation ─────────────────────────────────────────────────────────

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"deleted_at": "2020-01-01"}'::jsonb)
  $$,
  '22023',
  'CONTACT_MERGE_UNKNOWN_FIELD: deleted_at',
  'p_fields cannot name a column outside the allowlist'
);

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"status": "archived"}'::jsonb)
  $$,
  '22023',
  'CONTACT_MERGE_INVALID_FIELD: status',
  'p_fields cannot set a status the column check would reject'
);

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"owner_id": "80000000-0000-4000-8000-0000000001ff"}'::jsonb)
  $$,
  '22023',
  'CONTACT_MERGE_INVALID_FIELD: owner_id',
  'p_fields cannot assign an owner who is not a member of the workspace'
);

-- ── The merge itself ─────────────────────────────────────────────────────────

select lives_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"name": "Иван П.", "email": "ivan@example.com"}'::jsonb)
  $$,
  'an admin merges two contacts in the same workspace'
);

reset role;

select is(
  (select count(*)::int from public.conversations
    where contact_id = '80000000-0000-4000-8000-000000000401'),
  2,
  'both conversations belong to the survivor'
);

-- The hazard the ordering in merge_contacts exists to prevent: the loser is
-- archived LAST, so trg_cascade_contact_archive finds no conversations of its
-- own to stamp and the moved threads stay live.
select is(
  (select count(*)::int from public.conversations
    where contact_id = '80000000-0000-4000-8000-000000000401'
      and deleted_at is null),
  2,
  'the moved conversations were not archived by the cascade trigger'
);

select is(
  (select contact_id from public.contact_notes
    where id = '80000000-0000-4000-8000-000000000801'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'the note moved to the survivor'
);

select is(
  (select contact_id from public.contact_channels
    where id = '80000000-0000-4000-8000-000000000701'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'the channel identity moved to the survivor'
);

-- Three phone rows existed; two spelled the same number. The survivor keeps two.
select is(
  (select count(*)::int from public.contact_phones
    where contact_id = '80000000-0000-4000-8000-000000000401'),
  2,
  'a number the survivor already held collapsed instead of raising 23505'
);

select is(
  (select count(*)::int from public.contact_phones
    where contact_id = '80000000-0000-4000-8000-000000000402'),
  0,
  'the loser keeps no phone rows'
);

select is(
  (select array_agg(position order by position)
     from public.contact_phones
    where contact_id = '80000000-0000-4000-8000-000000000401'),
  array[0, 1],
  'the survivor''s phone positions are renumbered contiguously from zero'
);

select is(
  (select phone from public.contacts
    where id = '80000000-0000-4000-8000-000000000401'),
  '+7 999 123-45-67',
  'contacts.phone still holds the survivor''s position-0 number'
);

select is(
  (select name from public.contacts
    where id = '80000000-0000-4000-8000-000000000401'),
  'Иван П.',
  'the picked name overwrote the survivor''s'
);

select is(
  (select name from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  'Ivan P.',
  'the loser''s own scalars are untouched: its row is the record of what it was'
);

select is(
  (select merged_by from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  '80000000-0000-4000-8000-000000000101'::uuid,
  'merged_by records the acting admin'
);

select ok(
  (select deleted_at is not null and merged_at is not null
     from public.contacts where id = '80000000-0000-4000-8000-000000000402'),
  'the loser is archived and stamped in the same statement'
);

-- ── Already merged, and the conversation clash ───────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a contact that has already been merged cannot be merged again'
);

reset role;

-- Two fresh contacts, each with a thread on the SAME channel row. That pair
-- cannot be merged: conversations_contact_channel_unique (contact_id,
-- channel_id) would be violated, and folding the threads is a separate feature.
insert into public.contacts (id, workspace_id, name, source)
values
  ('80000000-0000-4000-8000-000000000403',
   '80000000-0000-4000-8000-000000000201', 'Clash A', 'telegram'),
  ('80000000-0000-4000-8000-000000000404',
   '80000000-0000-4000-8000-000000000201', 'Clash B', 'telegram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values
  ('80000000-0000-4000-8000-000000000503',
   '80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000403',
   '80000000-0000-4000-8000-000000000301'),
  ('80000000-0000-4000-8000-000000000504',
   '80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000404',
   '80000000-0000-4000-8000-000000000301');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000403',
      '80000000-0000-4000-8000-000000000404')
  $$,
  'P0001',
  'CONTACT_MERGE_CONVERSATION_CONFLICT',
  'two contacts holding a thread on the same channel cannot be merged'
);

reset role;

select is(
  (select contact_id from public.conversations
    where id = '80000000-0000-4000-8000-000000000504'),
  '80000000-0000-4000-8000-000000000404'::uuid,
  'the refused merge moved nothing: the whole statement rolled back'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Final review: merge never chains, tags union, last_seen_at
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 20260810090400 taught merge_contacts to repoint any contact that pointed at
-- a survivor which is itself later merged away. Fixture numbering continues
-- the …04 range above (…405 through …411), none of which carry conversations,
-- so none of these merges can hit the channel-clash refusal.

reset role;

insert into public.contacts (id, workspace_id, name, source)
values
  ('80000000-0000-4000-8000-000000000405',
   '80000000-0000-4000-8000-000000000201', 'Chain X', 'manual'),
  ('80000000-0000-4000-8000-000000000406',
   '80000000-0000-4000-8000-000000000201', 'Chain Y', 'manual'),
  ('80000000-0000-4000-8000-000000000407',
   '80000000-0000-4000-8000-000000000201', 'Chain Z', 'manual');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000406',
      '80000000-0000-4000-8000-000000000405')
  $$,
  'X merges into Y'
);

select lives_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000407',
      '80000000-0000-4000-8000-000000000406')
  $$,
  'Y -- itself a survivor a moment ago -- merges into Z'
);

reset role;

select is(
  (select merged_into_id from public.contacts
    where id = '80000000-0000-4000-8000-000000000405'),
  '80000000-0000-4000-8000-000000000407'::uuid,
  'merging Y into Z repoints X (merged into Y earlier) straight onto Z -- merge never chains'
);

-- ── tags: distinct union, with a duplicate tag on both sides ────────────────

insert into public.contacts (id, workspace_id, name, source, tags, last_seen_at)
values
  ('80000000-0000-4000-8000-000000000408',
   '80000000-0000-4000-8000-000000000201', 'Union Survivor', 'manual',
   array['vip', 'longtime'], null),
  ('80000000-0000-4000-8000-000000000409',
   '80000000-0000-4000-8000-000000000201', 'Union Loser', 'manual',
   array['vip', 'urgent'], '2026-01-01T00:00:00Z');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000408',
      '80000000-0000-4000-8000-000000000409')
  $$,
  'a merge where both sides share the "vip" tag'
);

reset role;

select is(
  (select tags from public.contacts
    where id = '80000000-0000-4000-8000-000000000408'),
  array['longtime', 'urgent', 'vip'],
  'the survivor''s tags are the distinct union of both sides -- the shared "vip" is not duplicated'
);

select is(
  (select last_seen_at from public.contacts
    where id = '80000000-0000-4000-8000-000000000408'),
  '2026-01-01T00:00:00Z'::timestamptz,
  'last_seen_at fills in from the loser when the survivor was never seen'
);

-- ── last_seen_at: the later of the two, not simply the loser's ──────────────

insert into public.contacts (id, workspace_id, name, source, last_seen_at)
values
  ('80000000-0000-4000-8000-000000000410',
   '80000000-0000-4000-8000-000000000201', 'Recency Survivor', 'manual',
   '2026-06-01T00:00:00Z'),
  ('80000000-0000-4000-8000-000000000411',
   '80000000-0000-4000-8000-000000000201', 'Recency Loser', 'manual',
   '2026-01-01T00:00:00Z');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000410',
      '80000000-0000-4000-8000-000000000411')
  $$,
  'a merge where the survivor was already seen more recently than the loser'
);

reset role;

select is(
  (select last_seen_at from public.contacts
    where id = '80000000-0000-4000-8000-000000000410'),
  '2026-06-01T00:00:00Z'::timestamptz,
  'the survivor''s more recent last_seen_at is not overwritten by the loser''s older one'
);

select * from finish();
rollback;
