begin;

select plan(16);

-- conversations was the one table in the message graph that 20260804100300 left
-- on single-column foreign keys, and its UPDATE policy stopped verifying that
-- channel_id and contact_id belong to the conversation's own workspace the
-- moment 20260808090000 rewrote that policy for deleted_at. Between those two
-- facts a member of workspace A could repoint their own conversation at
-- workspace B's channel and then have send-whatsapp-message load B's
-- credentials for it -- the send functions resolve the channel from the
-- conversation and never compare workspaces.
--
-- Three layers are asserted here, because closing any one of them alone leaves
-- the hole open for a different writer:
--
--   the constraint  catches service_role -- the webhooks and send functions
--                   bypass RLS entirely, so only a table constraint reaches
--                   them
--   the grant       catches authenticated -- the two columns are simply not
--                   writable through PostgREST any more
--   the function    sync_contact_last_seen scoped to the message's workspace,
--                   so a row written before the constraint existed still cannot
--                   reach a contact outside it
--
-- Each repoint check gets its own conversation row. They are checks on writes
-- that must fail, so on an unfixed schema they succeed instead -- and a shared
-- row would carry one check's leftover state into the next, where
-- conversations_contact_channel_unique would report 23505 and hide the defect
-- the later check is about.
--
-- Fixture numbering avoids every range used by the other files:
--   users …01{01,02,03}  workspaces …02{01,02}  channels …03{01,02}
--   contacts …04{01..07,11..14}  conversations …05{01..04,11..14,21,22}
--   messages …06{01,02}

insert into auth.users (id, email, raw_user_meta_data)
values
  ('70000000-0000-4000-8000-000000000101', 'xws-a-owner@example.com',
   '{"full_name":"Workspace A Owner"}'::jsonb),
  ('70000000-0000-4000-8000-000000000102', 'xws-b-owner@example.com',
   '{"full_name":"Workspace B Owner"}'::jsonb),
  ('70000000-0000-4000-8000-000000000103', 'xws-both@example.com',
   '{"full_name":"Member Of Both"}'::jsonb);

insert into public.workspaces (id, name, is_main, created_by)
values
  ('70000000-0000-4000-8000-000000000201', 'Cross WS A', false,
   '70000000-0000-4000-8000-000000000101'),
  ('70000000-0000-4000-8000-000000000202', 'Cross WS B', false,
   '70000000-0000-4000-8000-000000000102');

-- on_workspace_created made each owner's membership. …0103 belongs to both,
-- which is the realistic shape of the contacts half of this: an agency user, or
-- anyone invited to a second workspace, already passes is_workspace_member on
-- either side, so the UPDATE policy has nothing to object to.
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('70000000-0000-4000-8000-000000000201',
   '70000000-0000-4000-8000-000000000103', 'member'),
  ('70000000-0000-4000-8000-000000000202',
   '70000000-0000-4000-8000-000000000103', 'member');

insert into public.channels (id, workspace_id, type, name, is_active)
values
  ('70000000-0000-4000-8000-000000000301',
   '70000000-0000-4000-8000-000000000201', 'whatsapp', 'A WhatsApp', true),
  ('70000000-0000-4000-8000-000000000302',
   '70000000-0000-4000-8000-000000000202', 'whatsapp', 'B WhatsApp', true);

insert into public.contacts (id, workspace_id, name, source)
values
  ('70000000-0000-4000-8000-000000000401',
   '70000000-0000-4000-8000-000000000201', 'A Customer', 'whatsapp'),
  ('70000000-0000-4000-8000-000000000403',
   '70000000-0000-4000-8000-000000000201', 'A Second Customer', 'manual'),
  -- Nothing references …0407, so the workspace_id rewrite below answers for the
  -- privilege alone and not for a composite foreign key left dangling.
  ('70000000-0000-4000-8000-000000000407',
   '70000000-0000-4000-8000-000000000201', 'A Loose Contact', 'manual'),
  ('70000000-0000-4000-8000-000000000411',
   '70000000-0000-4000-8000-000000000201', 'A Repoint 1', 'manual'),
  ('70000000-0000-4000-8000-000000000412',
   '70000000-0000-4000-8000-000000000201', 'A Repoint 2', 'manual'),
  ('70000000-0000-4000-8000-000000000413',
   '70000000-0000-4000-8000-000000000201', 'A Repoint 3', 'manual'),
  ('70000000-0000-4000-8000-000000000414',
   '70000000-0000-4000-8000-000000000201', 'A Repoint 4', 'manual'),
  ('70000000-0000-4000-8000-000000000402',
   '70000000-0000-4000-8000-000000000202', 'B Customer', 'whatsapp'),
  ('70000000-0000-4000-8000-000000000405',
   '70000000-0000-4000-8000-000000000202', 'B Second Customer', 'whatsapp'),
  ('70000000-0000-4000-8000-000000000406',
   '70000000-0000-4000-8000-000000000202', 'B Third Customer', 'whatsapp');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values
  ('70000000-0000-4000-8000-000000000501',
   '70000000-0000-4000-8000-000000000201',
   '70000000-0000-4000-8000-000000000401',
   '70000000-0000-4000-8000-000000000301'),
  ('70000000-0000-4000-8000-000000000502',
   '70000000-0000-4000-8000-000000000202',
   '70000000-0000-4000-8000-000000000402',
   '70000000-0000-4000-8000-000000000302'),
  ('70000000-0000-4000-8000-000000000511',
   '70000000-0000-4000-8000-000000000201',
   '70000000-0000-4000-8000-000000000411',
   '70000000-0000-4000-8000-000000000301'),
  ('70000000-0000-4000-8000-000000000512',
   '70000000-0000-4000-8000-000000000201',
   '70000000-0000-4000-8000-000000000412',
   '70000000-0000-4000-8000-000000000301'),
  ('70000000-0000-4000-8000-000000000513',
   '70000000-0000-4000-8000-000000000201',
   '70000000-0000-4000-8000-000000000413',
   '70000000-0000-4000-8000-000000000301'),
  ('70000000-0000-4000-8000-000000000514',
   '70000000-0000-4000-8000-000000000201',
   '70000000-0000-4000-8000-000000000414',
   '70000000-0000-4000-8000-000000000301');


-- ── The constraint: reachable by service_role, which RLS does not police ─────
--
-- These run as the test-runner role, which bypasses RLS exactly as the webhooks
-- and the send functions do. Only a table constraint can answer here.

select throws_ok(
  $$
    insert into public.conversations (id, workspace_id, contact_id, channel_id)
    values ('70000000-0000-4000-8000-000000000521',
            '70000000-0000-4000-8000-000000000201',
            '70000000-0000-4000-8000-000000000403',
            '70000000-0000-4000-8000-000000000302')
  $$,
  '23503',
  null,
  'a conversation cannot be created against a channel in another workspace'
);

select throws_ok(
  $$
    insert into public.conversations (id, workspace_id, contact_id, channel_id)
    values ('70000000-0000-4000-8000-000000000522',
            '70000000-0000-4000-8000-000000000201',
            '70000000-0000-4000-8000-000000000402',
            '70000000-0000-4000-8000-000000000301')
  $$,
  '23503',
  null,
  'nor against a contact in another workspace'
);

-- Both inserts throw once the constraint exists, so this removes nothing.
-- Without it, an unfixed schema carries their rows into the checks below.
delete from public.conversations
where id in ('70000000-0000-4000-8000-000000000521',
             '70000000-0000-4000-8000-000000000522');

select throws_ok(
  $$
    update public.conversations
    set channel_id = '70000000-0000-4000-8000-000000000302'
    where id = '70000000-0000-4000-8000-000000000511'
  $$,
  '23503',
  null,
  'an existing conversation cannot be repointed at another workspace''s channel'
);

select throws_ok(
  $$
    update public.conversations
    set contact_id = '70000000-0000-4000-8000-000000000402'
    where id = '70000000-0000-4000-8000-000000000512'
  $$,
  '23503',
  null,
  'nor at another workspace''s contact'
);

select lives_ok(
  $$
    insert into public.conversations
      (id, workspace_id, contact_id, channel_id)
    values ('70000000-0000-4000-8000-000000000503',
            '70000000-0000-4000-8000-000000000201',
            '70000000-0000-4000-8000-000000000403',
            '70000000-0000-4000-8000-000000000301')
  $$,
  'a correctly scoped conversation still inserts'
);


-- ── The grant: reachable by authenticated, through PostgREST ─────────────────
--
-- The UPDATE policy cannot be what stops this. Its WITH CHECK reads the row's
-- own workspace_id, which the attacker never changes -- it stays A on a
-- conversation now pointing at B's channel. Taking the columns out of the grant
-- is what makes the write unexpressible, so the expected error is 42501 rather
-- than a policy violation.

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"70000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    update public.conversations
    set channel_id = '70000000-0000-4000-8000-000000000302'
    where id = '70000000-0000-4000-8000-000000000513'
  $$,
  '42501',
  null,
  'a member of workspace A cannot rewrite conversations.channel_id at all'
);

select throws_ok(
  $$
    update public.conversations
    set contact_id = '70000000-0000-4000-8000-000000000405'
    where id = '70000000-0000-4000-8000-000000000514'
  $$,
  '42501',
  null,
  'nor conversations.contact_id'
);

set local request.jwt.claims =
  '{"sub":"70000000-0000-4000-8000-000000000103","role":"authenticated"}';

select throws_ok(
  $$
    update public.contacts
    set workspace_id = '70000000-0000-4000-8000-000000000202'
    where id = '70000000-0000-4000-8000-000000000407'
  $$,
  '42501',
  null,
  'a member of both workspaces cannot move a contact from one to the other'
);


-- ── What the inbox actually writes still works ───────────────────────────────

set local request.jwt.claims =
  '{"sub":"70000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    update public.conversations
    set status = 'closed', assigned_to = '70000000-0000-4000-8000-000000000101'
    where id = '70000000-0000-4000-8000-000000000501'
  $$,
  'the two columns the inbox writes -- status and assigned_to -- are still writable'
);

select is(
  (select status || '|' || assigned_to::text from public.conversations
   where id = '70000000-0000-4000-8000-000000000501'),
  'closed|70000000-0000-4000-8000-000000000101',
  'and the write landed'
);

select lives_ok(
  $$
    update public.contacts
    set name = 'Renamed', phone = '+7 999 000-00-01', email = 'a@example.com',
        status = 'in_progress', tags = array['vip'],
        owner_id = '70000000-0000-4000-8000-000000000101'
    where id = '70000000-0000-4000-8000-000000000401'
  $$,
  'every column the contact form writes is still writable'
);

select is(
  (select name from public.contacts
   where id = '70000000-0000-4000-8000-000000000401'),
  'Renamed',
  'and that write landed too'
);

-- set_contact_phones is SECURITY INVOKER and syncs contacts.phone as the
-- caller, so the narrowed grant has to keep phone in the list.
select lives_ok(
  $$
    select public.set_contact_phones(
      '70000000-0000-4000-8000-000000000201',
      '70000000-0000-4000-8000-000000000401',
      array['+7 999 000-00-02']
    )
  $$,
  'set_contact_phones still syncs contacts.phone under invoker rights'
);

reset role;


-- ── sync_contact_last_seen: scoped to the message's workspace ────────────────

select lives_ok(
  $$
    insert into public.messages
      (id, workspace_id, conversation_id, direction, type, content)
    values ('70000000-0000-4000-8000-000000000601',
            '70000000-0000-4000-8000-000000000201',
            '70000000-0000-4000-8000-000000000501',
            'inbound', 'text', 'Hello')
  $$,
  'an inbound message on a well-scoped conversation still bumps its contact'
);

-- The constraint above now makes a mis-scoped conversation unwritable, so the
-- only way to hold one is to drop the constraint -- which is the state every
-- row written before this migration was in. The function must not depend on the
-- constraint to stay inside a workspace: its siblings cascade_contact_archive
-- and unarchive_on_inbound_message both join on workspace_id, and it did not.
alter table public.conversations
  drop constraint conversations_contact_workspace_fkey;

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('70000000-0000-4000-8000-000000000504',
        '70000000-0000-4000-8000-000000000201',
        '70000000-0000-4000-8000-000000000406',
        '70000000-0000-4000-8000-000000000301');

insert into public.messages
  (id, workspace_id, conversation_id, direction, type, content)
values ('70000000-0000-4000-8000-000000000602',
        '70000000-0000-4000-8000-000000000201',
        '70000000-0000-4000-8000-000000000504',
        'inbound', 'text', 'Leak?');

select is(
  (select last_seen_at from public.contacts
   where id = '70000000-0000-4000-8000-000000000406'),
  null,
  'an inbound message in workspace A cannot bump last_seen_at on a contact in workspace B'
);

select isnt(
  (select last_seen_at from public.contacts
   where id = '70000000-0000-4000-8000-000000000401'),
  null,
  'while the same-workspace contact was bumped normally'
);

select * from finish();

rollback;
