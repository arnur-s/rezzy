begin;

select plan(8);

-- The duplicate finder groups live contacts that share an exact identity key:
-- normalized phone digits, a channel identity, or a lowercased email. It never
-- groups on a name -- two people share a name far more often than a number.
--
-- Fixture numbering, 90000000 range, unused elsewhere:
--   users …0101  workspaces …02{01,02}  channels …03{01,02}
--   contacts …04{01..06}  conversations …0501

insert into auth.users (id, email, raw_user_meta_data)
values ('90000000-0000-4000-8000-000000000101', 'dup-owner@example.com',
        '{"full_name":"Dup Owner"}'::jsonb);

insert into public.workspaces (id, name, is_main, created_by)
values
  ('90000000-0000-4000-8000-000000000201', 'Dup WS', false,
   '90000000-0000-4000-8000-000000000101'),
  -- A second workspace the user is NOT a member of, to prove the boundary.
  ('90000000-0000-4000-8000-000000000202', 'Other WS', false,
   '90000000-0000-4000-8000-000000000101');

delete from public.workspace_members
where workspace_id = '90000000-0000-4000-8000-000000000202';

insert into public.channels (id, workspace_id, type, name, is_active)
values ('90000000-0000-4000-8000-000000000301',
        '90000000-0000-4000-8000-000000000201', 'telegram', 'Dup TG', true);

insert into public.contacts (id, workspace_id, name, phone, email, source)
values
  -- …401/…402 share a number, spelled two ways, AND an email. One group.
  ('90000000-0000-4000-8000-000000000401',
   '90000000-0000-4000-8000-000000000201', 'Мария И.',
   '+7 999 555-11-22', 'maria@example.com', 'telegram'),
  ('90000000-0000-4000-8000-000000000402',
   '90000000-0000-4000-8000-000000000201', 'Maria I.',
   '+79995551122', 'MARIA@example.com', 'manual'),
  -- …403/…404 share only an email.
  ('90000000-0000-4000-8000-000000000403',
   '90000000-0000-4000-8000-000000000201', 'Пётр',
   null, 'petr@example.com', 'manual'),
  ('90000000-0000-4000-8000-000000000404',
   '90000000-0000-4000-8000-000000000201', 'Petr',
   null, 'petr@example.com', 'manual'),
  -- …405 is archived and shares …403's email: it must not appear.
  ('90000000-0000-4000-8000-000000000405',
   '90000000-0000-4000-8000-000000000201', 'Archived Petr',
   null, 'petr@example.com', 'manual'),
  -- …406 is alone.
  ('90000000-0000-4000-8000-000000000406',
   '90000000-0000-4000-8000-000000000201', 'Один',
   '+7 903 000-00-00', null, 'manual');

update public.contacts
set deleted_at = now()
where id = '90000000-0000-4000-8000-000000000405';

-- Two contacts in the other workspace sharing an email.
insert into public.contacts (id, workspace_id, name, email, source)
values
  ('90000000-0000-4000-8000-000000000501',
   '90000000-0000-4000-8000-000000000202', 'Hidden A', 'hidden@example.com', 'manual'),
  ('90000000-0000-4000-8000-000000000502',
   '90000000-0000-4000-8000-000000000202', 'Hidden B', 'hidden@example.com', 'manual');

insert into public.contact_phones (workspace_id, contact_id, phone, position)
values
  ('90000000-0000-4000-8000-000000000201',
   '90000000-0000-4000-8000-000000000401', '+7 999 555-11-22', 0),
  ('90000000-0000-4000-8000-000000000201',
   '90000000-0000-4000-8000-000000000402', '+79995551122', 0);

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('90000000-0000-4000-8000-000000000601',
        '90000000-0000-4000-8000-000000000201',
        '90000000-0000-4000-8000-000000000401',
        '90000000-0000-4000-8000-000000000301');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"90000000-0000-4000-8000-000000000101","role":"authenticated"}';

-- ── Grouping ─────────────────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')),
  2,
  'two groups: the phone/email pair and the email-only pair'
);

select is(
  (select match_reason from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where '90000000-0000-4000-8000-000000000401' =
          any (select (value ->> 'id')::uuid from jsonb_array_elements(contacts))),
  'phone',
  'a pair matching on both phone and email is reported once, under phone'
);

select is(
  (select contact_count from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where match_reason = 'email'),
  2,
  'the archived contact sharing that email is not counted'
);

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where '90000000-0000-4000-8000-000000000406' =
          any (select (value ->> 'id')::uuid from jsonb_array_elements(contacts))),
  0,
  'a contact with no twin is in no group'
);

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000202')),
  0,
  'a workspace the caller does not belong to yields nothing: RLS is the boundary'
);

select is(
  (select (contacts -> 0 ->> 'conversation_count')::int
     from public.list_duplicate_contact_groups(
       '90000000-0000-4000-8000-000000000201')
    where match_reason = 'phone'),
  1,
  'each member carries its conversation count, for the survivor default'
);

-- ── Legacy rows ──────────────────────────────────────────────────────────────
--
-- …403/…404 have no contact_phones rows at all. Give one of them a number that
-- lives only in contacts.phone, matching a number …406 holds, and the pair must
-- still group -- rows written before 20260803120000 are not invisible.

reset role;
update public.contacts set phone = '+7 903 000-00-00'
where id = '90000000-0000-4000-8000-000000000403';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"90000000-0000-4000-8000-000000000101","role":"authenticated"}';

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where match_reason = 'phone'),
  2,
  'a number held only in contacts.phone still groups'
);

-- ── Child counts ─────────────────────────────────────────────────────────────

select results_eq(
  $$
    select conversation_count, note_count, phone_count, channel_count
    from public.count_contact_merge_children(
      '90000000-0000-4000-8000-000000000201',
      '90000000-0000-4000-8000-000000000401')
  $$,
  $$ values (1, 0, 1, 0) $$,
  'the merge preview counts exactly what will move'
);

select * from finish();
rollback;
