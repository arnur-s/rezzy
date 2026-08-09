begin;

select plan(22);

-- Contract for the number behind a WhatsApp identity:
-- public.phone_from_wa_id, public.set_contact_phone_from_whatsapp_identity, and
-- the one-shot backfill in 20260809110000.
--
-- A wa_id is the subscriber's number without the leading `+`, so a contact known
-- only through WhatsApp still has a phone number -- it was simply never copied
-- into the column every screen reads. These assertions pin both halves: the rows
-- the migration repaired, and the rule that keeps new ones correct.
--
-- Fixture numbering avoids the ranges used by the other contact tests:
--   users …01{41,42}   workspaces …02{41}   channels …04{41..43}
--   contacts …03{41..46}

-- ── phone_from_wa_id ──────────────────────────────────────────────────────────
select has_function('public', 'phone_from_wa_id', array['text'],
  'phone_from_wa_id exists');
select ok(
  has_function_privilege('authenticated', 'public.phone_from_wa_id(text)', 'execute'),
  'authenticated can derive a number from an identity'
);
select ok(
  not has_function_privilege('anon', 'public.phone_from_wa_id(text)', 'execute'),
  'anon cannot'
);

select is(public.phone_from_wa_id('77074391255'), '+77074391255',
  'a wa_id is the same number the card shows, plus the + the provider strips');
select is(public.phone_from_wa_id('  77015550001  '), '+77015550001',
  'surrounding whitespace is not part of the number');
select is(public.phone_from_wa_id('+77015550001'), null,
  'anything that is not a plain digit string is refused rather than double-prefixed');
select is(public.phone_from_wa_id('7701'), null,
  'four digits is a fragment, not a number: the floor matches contact_phones');
select is(public.phone_from_wa_id(repeat('9', 32)), null,
  'a value too long to survive contact_phones'' 32-character limit is refused');
select is(public.phone_from_wa_id(null), null,
  'strict: a missing identity does not become the string "+"');

select has_trigger('public', 'contact_channels',
  'trg_set_contact_phone_from_whatsapp_identity',
  'contact_channels carries the trigger that fills the number in');

-- ── The rows that already existed ─────────────────────────────────────────────
--
-- Asserted before this file inserts anything, so it describes the state the
-- migration's backfill left behind rather than the trigger's work below.
select is(
  (
    select count(*)::int
    from public.contacts c
    where c.phone is null
      and exists (
        select 1
        from public.contact_channels cc
        where cc.contact_id = c.id
          and cc.channel_type = 'whatsapp'
          and public.phone_from_wa_id(cc.external_id) is not null
      )
  ),
  0,
  'the backfill left no WhatsApp contact without the number its identity carries'
);

-- ── Fixtures ──────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  ('20000000-0000-4000-8000-000000000141','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','wa.phone.member@example.com','x',now(),now(),now(),
   '{"full_name":"WA Phone Member"}');

insert into public.workspaces (id, name, created_by) values
  ('20000000-0000-4000-8000-000000000241','WA Phone WS',
   '20000000-0000-4000-8000-000000000141');

insert into public.channels (id, workspace_id, type, name) values
  ('20000000-0000-4000-8000-000000000441','20000000-0000-4000-8000-000000000241','whatsapp','WA'),
  ('20000000-0000-4000-8000-000000000442','20000000-0000-4000-8000-000000000241','telegram','TG'),
  ('20000000-0000-4000-8000-000000000443','20000000-0000-4000-8000-000000000241','instagram','IG');

insert into public.contacts (id, workspace_id, name, phone, status, deleted_at) values
  ('20000000-0000-4000-8000-000000000341','20000000-0000-4000-8000-000000000241','WA Only',null,'new',null),
  ('20000000-0000-4000-8000-000000000342','20000000-0000-4000-8000-000000000241','Typed Number','+70000000042','new',null),
  ('20000000-0000-4000-8000-000000000343','20000000-0000-4000-8000-000000000241','Telegram Only',null,'new',null),
  ('20000000-0000-4000-8000-000000000344','20000000-0000-4000-8000-000000000241','Instagram Only',null,'new',null),
  ('20000000-0000-4000-8000-000000000345','20000000-0000-4000-8000-000000000241','Malformed Identity',null,'new',null),
  ('20000000-0000-4000-8000-000000000346','20000000-0000-4000-8000-000000000241','Archived',null,'new',now());

insert into public.contact_channels (contact_id, workspace_id, channel_id, channel_type,
                                     external_id, external_name)
values
  ('20000000-0000-4000-8000-000000000341','20000000-0000-4000-8000-000000000241',
   '20000000-0000-4000-8000-000000000441','whatsapp','77015550041','WA Only'),
  ('20000000-0000-4000-8000-000000000342','20000000-0000-4000-8000-000000000241',
   '20000000-0000-4000-8000-000000000441','whatsapp','77015550042','Typed Number'),
  -- Digits, and still not a phone number. Telegram user ids look exactly like
  -- short international numbers, which is precisely why the derivation is keyed
  -- on the channel type rather than on the shape of the value.
  ('20000000-0000-4000-8000-000000000343','20000000-0000-4000-8000-000000000241',
   '20000000-0000-4000-8000-000000000442','telegram','1828828720','Telegram Only'),
  ('20000000-0000-4000-8000-000000000344','20000000-0000-4000-8000-000000000241',
   '20000000-0000-4000-8000-000000000443','instagram','ig-scoped-id','Instagram Only'),
  ('20000000-0000-4000-8000-000000000345','20000000-0000-4000-8000-000000000241',
   '20000000-0000-4000-8000-000000000441','whatsapp','not-a-number','Malformed Identity'),
  -- Written here rather than through a member, because no member can: see the
  -- archived-contact assertion below.
  ('20000000-0000-4000-8000-000000000346','20000000-0000-4000-8000-000000000241',
   '20000000-0000-4000-8000-000000000441','whatsapp','77015550046','Archived');

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000341'),
  '+77015550041',
  'a new WhatsApp identity fills in the contact''s number'
);

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000342'),
  '+70000000042',
  'a number somebody typed is never replaced by the derived one'
);

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000343'),
  null,
  'a Telegram user id is not a phone number, however much it looks like one'
);

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000344'),
  null,
  'an Instagram-scoped id is not a phone number either'
);

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000345'),
  null,
  'a malformed wa_id leaves the field empty rather than storing something undialable'
);

-- ── The identity changing ─────────────────────────────────────────────────────
update public.contact_channels
set external_id = '77015550045'
where contact_id = '20000000-0000-4000-8000-000000000345';

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000345'),
  '+77015550045',
  'correcting the identity fills in the number the contact could not have before'
);

-- Cleared deliberately, then the webhook's ordinary refresh of the display name
-- runs. The trigger is restricted to the columns the number comes from, so this
-- must NOT put it back: an empty field is sometimes an answer.
update public.contacts set phone = null
where id = '20000000-0000-4000-8000-000000000345';
update public.contact_channels
set external_name = 'Renamed By Provider'
where contact_id = '20000000-0000-4000-8000-000000000345';

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000345'),
  null,
  'a profile-name refresh does not re-fill a number the user cleared'
);

-- ── Who writes the identity does not matter ──────────────────────────────────
--
-- First an ordinary member, which is the client path: linking an identity by
-- hand fills the number in exactly as the webhook's does.
insert into public.workspace_members (workspace_id, user_id, role)
values ('20000000-0000-4000-8000-000000000241',
        '20000000-0000-4000-8000-000000000141','owner')
on conflict do nothing;

insert into public.contacts (id, workspace_id, name, phone, status) values
  ('20000000-0000-4000-8000-000000000347','20000000-0000-4000-8000-000000000241',
   'Linked By Member',null,'new');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000141","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.contact_channels (contact_id, workspace_id, channel_id,
                                         channel_type, external_id, external_name)
    values ('20000000-0000-4000-8000-000000000347','20000000-0000-4000-8000-000000000241',
            '20000000-0000-4000-8000-000000000441','whatsapp','77015550047','Linked By Member')
  $$,
  'a member can link a WhatsApp identity'
);

reset role;

select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000347'),
  '+77015550047',
  'an identity linked by a member fills the number in the same way'
);

-- Then an archived contact, which only the webhook can reach: the
-- contact_channels policies resolve the contact through its SELECT policy, and
-- that policy hides archived rows from members entirely. The contact whose
-- number is missing is exactly the one nobody is looking at, so it must be
-- filled in here too rather than waiting for someone to notice.
select is(
  (select phone from public.contacts where id = '20000000-0000-4000-8000-000000000346'),
  '+77015550046',
  'an archived contact gets its number as well'
);

select is(
  (select count(*)::int from public.contact_phones
   where contact_id = '20000000-0000-4000-8000-000000000341'),
  0,
  'the derived number stays out of contact_phones, whose only writer is set_contact_phones'
);

select * from finish();
rollback;
