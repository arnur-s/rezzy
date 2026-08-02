begin;

select plan(40);

-- Contract for multi-number contacts and the server-side identity lookup:
-- public.contact_phones, public.phone_digits, public.set_contact_phones,
-- public.list_contact_phones, public.match_workspace_contacts, and the
-- workspace phone region.
--
-- Fixture numbering avoids the ranges used by contact_notes.test.sql and
-- contacts_directory.test.sql:
--   users …01{21,22}   workspaces …02{21,22}   channels …04{21}
--   contacts …03{21..25}

-- ── Shape / security metadata ─────────────────────────────────────────────────
select has_table('public', 'contact_phones', 'contact_phones table exists');
select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'contact_phones'
  ),
  'contact_phones has RLS enabled'
);
select has_column('public', 'contact_phones', 'workspace_id', 'contact_phones has workspace_id');
select has_column('public', 'contact_phones', 'contact_id', 'contact_phones has contact_id');
select has_column('public', 'contact_phones', 'phone', 'contact_phones has phone');
select has_column('public', 'contact_phones', 'digits', 'contact_phones has digits');
select has_column('public', 'contact_phones', 'position', 'contact_phones has position');

select ok(
  (
    select a.attgenerated = 's'
    from pg_attribute a
    where a.attrelid = 'public.contact_phones'::regclass and a.attname = 'digits'
  ),
  'digits is a stored generated column, so it cannot drift from phone'
);

select has_index('public', 'contact_phones', 'contact_phones_workspace_digits_idx',
  'workspace-scoped digit lookups are indexed');
select has_index('public', 'contact_phones', 'contact_phones_contact_digits_key',
  'one contact cannot hold the same number twice');

select policies_are(
  'public',
  'contact_phones',
  array[
    'Workspace members can view contact phones',
    'Workspace members can add contact phones',
    'Workspace members can update contact phones',
    'Workspace members can delete contact phones'
  ],
  'contact_phones exposes only the intended RLS policies'
);

select has_column('public', 'workspaces', 'default_phone_region',
  'workspaces carry an optional default phone region');
select col_is_null('public', 'workspaces', 'default_phone_region',
  'the region is nullable: unknown must stay unknown rather than defaulting to a country');

select ok(
  has_function_privilege('authenticated', 'public.match_workspace_contacts(uuid,text[],text[],text[],integer)', 'execute')
  and has_function_privilege('authenticated', 'public.set_contact_phones(uuid,uuid,text[])', 'execute')
  and has_function_privilege('authenticated', 'public.list_contact_phones(uuid,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_workspace_phone_region(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.set_workspace_phone_region(uuid,text)', 'execute'),
  'authenticated can execute every contact-identity RPC'
);
select ok(
  not has_function_privilege('anon', 'public.match_workspace_contacts(uuid,text[],text[],text[],integer)', 'execute'),
  'anon cannot run the identity lookup'
);

-- ── phone_digits ──────────────────────────────────────────────────────────────
select is(public.phone_digits('+7 701 123 45 67'), '77011234567',
  'phone_digits strips every separator');
select is(public.phone_digits(null), null,
  'phone_digits is strict: a missing number does not normalize to the empty string');

-- ── Fixtures ──────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  ('20000000-0000-4000-8000-000000000121','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','phone.member@example.com','x',now(),now(),now(),
   '{"full_name":"Phone Member"}'),
  ('20000000-0000-4000-8000-000000000122','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','phone.outsider@example.com','x',now(),now(),now(),
   '{"full_name":"Phone Outsider"}');

insert into public.workspaces (id, name, created_by) values
  ('20000000-0000-4000-8000-000000000221','Phone WS','20000000-0000-4000-8000-000000000121'),
  ('20000000-0000-4000-8000-000000000222','Other Phone WS','20000000-0000-4000-8000-000000000122');

insert into public.channels (id, workspace_id, type, name)
values ('20000000-0000-4000-8000-000000000421','20000000-0000-4000-8000-000000000221','whatsapp','WA');

insert into public.contacts (id, workspace_id, name, phone, email, status) values
  -- Stored in a domestic spelling: the lookup has to find it from +77011234567.
  ('20000000-0000-4000-8000-000000000321','20000000-0000-4000-8000-000000000221',
   'Dana Abisheva','8 (701) 123-45-67',null,'new'),
  ('20000000-0000-4000-8000-000000000322','20000000-0000-4000-8000-000000000221',
   'Aizhan Serik',null,'Aizhan@Example.com','new'),
  ('20000000-0000-4000-8000-000000000323','20000000-0000-4000-8000-000000000221',
   'Channel Only',null,null,'new'),
  ('20000000-0000-4000-8000-000000000324','20000000-0000-4000-8000-000000000221',
   'Dana Abisheva (duplicate)','+7 701 123 45 67',null,'new'),
  -- Same number, another workspace: must never appear in this workspace's match.
  ('20000000-0000-4000-8000-000000000325','20000000-0000-4000-8000-000000000222',
   'Someone Else','+77011234567',null,'new');

insert into public.contact_channels (contact_id, workspace_id, channel_id, channel_type,
                                     external_id, external_name)
values ('20000000-0000-4000-8000-000000000323','20000000-0000-4000-8000-000000000221',
        '20000000-0000-4000-8000-000000000421','whatsapp','77015550001','Channel Only');

-- The migration backfills existing numbers; these fixtures were inserted after it
-- ran, so they stand in for rows written by something other than the RPC — which
-- is exactly the case match_workspace_contacts also covers through contacts.phone.
select is(
  (select count(*)::int from public.contact_phones
   where contact_id = '20000000-0000-4000-8000-000000000321'),
  0,
  'a plain contacts insert does not populate contact_phones on its own'
);

-- ── set_contact_phones ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000121","role":"authenticated"}';

select is(
  (select count(*)::int from public.set_contact_phones(
     '20000000-0000-4000-8000-000000000221',
     '20000000-0000-4000-8000-000000000321',
     array['+7 701 123 45 67','+7 701 999 88 77','+77011234567','  '])),
  2,
  'two spellings of one number collapse, blanks are dropped'
);

select is(
  (select phone from public.contact_phones
   where contact_id = '20000000-0000-4000-8000-000000000321' and position = 0),
  '+7 701 123 45 67',
  'the first entry keeps the spelling it was given and becomes position 0'
);

select is(
  (select phone from public.contacts
   where id = '20000000-0000-4000-8000-000000000321'),
  '+7 701 123 45 67',
  'contacts.phone is synced to the primary number'
);

select is(
  (select count(*)::int from public.list_contact_phones(
     '20000000-0000-4000-8000-000000000221',
     '20000000-0000-4000-8000-000000000321')),
  2,
  'list_contact_phones returns the whole set'
);

select is(
  (select count(*)::int from public.set_contact_phones(
     '20000000-0000-4000-8000-000000000221',
     '20000000-0000-4000-8000-000000000321',
     array['+7 701 999 88 77'])),
  1,
  'replacing the set removes the numbers left out of it'
);

select is(
  (select phone from public.contacts
   where id = '20000000-0000-4000-8000-000000000321'),
  '+7 701 999 88 77',
  'the primary follows the new first entry'
);

select is(
  (select count(*)::int from public.set_contact_phones(
     '20000000-0000-4000-8000-000000000221',
     '20000000-0000-4000-8000-000000000321',
     array[]::text[])),
  0,
  'an empty set clears every number'
);

select is(
  (select phone from public.contacts
   where id = '20000000-0000-4000-8000-000000000321'),
  null,
  'clearing the set clears the primary rather than leaving a stale one'
);

-- Restore the domestic spelling for the matching assertions below.
select lives_ok(
  $$
    select public.set_contact_phones(
      '20000000-0000-4000-8000-000000000221',
      '20000000-0000-4000-8000-000000000321',
      array['8 (701) 123-45-67'])
  $$,
  'the fixture number is restored through the RPC'
);

-- ── match_workspace_contacts ──────────────────────────────────────────────────
select bag_eq(
  $$
    select name from public.match_workspace_contacts(
      '20000000-0000-4000-8000-000000000221',
      array['77011234567'])
  $$,
  $$ values ('Dana Abisheva'), ('Dana Abisheva (duplicate)') $$,
  'a differently formatted stored number matches, from contact_phones and from contacts.phone alike'
);

select is(
  (select count(*)::int from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221',
     array['77011234567'])
   where name = 'Someone Else'),
  0,
  'an identical number in another workspace is never returned'
);

select is(
  (select match_reason from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221',
     null, null, array['whatsapp:77015550001'])),
  'channel',
  'a provider identity matches its own channel and reports why'
);

select is(
  (select count(*)::int from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221',
     null, null, array['telegram:77015550001'])),
  0,
  'the same digits under a different channel type are a different person'
);

select is(
  (select name from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221',
     null, array['aizhan@example.com'])),
  'Aizhan Serik',
  'email matching is case-insensitive'
);

select is(
  (select count(*)::int from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221')),
  0,
  'a lookup with no identifiers matches nobody rather than everybody'
);

select is(
  (select count(*)::int from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221',
     array['70112345'])),
  0,
  'a partial number is not a match: comparison is equality, never a suffix'
);

-- ── Workspace phone region ────────────────────────────────────────────────────
select is(
  (select public.get_workspace_phone_region('20000000-0000-4000-8000-000000000221')),
  null,
  'a workspace starts with no phone region, so unqualified numbers stay ambiguous'
);

select is(
  (select public.set_workspace_phone_region('20000000-0000-4000-8000-000000000221','kz')),
  'KZ',
  'the region is normalized to upper case'
);

select throws_ok(
  $$ select public.set_workspace_phone_region(
       '20000000-0000-4000-8000-000000000221','Kazakhstan') $$,
  '22023', 'INVALID_PHONE_REGION',
  'a value that is not an ISO alpha-2 region is refused'
);

-- ── Isolation ─────────────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000122","role":"authenticated"}';

select is(
  (select count(*)::int from public.match_workspace_contacts(
     '20000000-0000-4000-8000-000000000221',
     array['77011234567'])),
  0,
  'naming another workspace explicitly returns nothing: RLS is the boundary'
);

select is(
  (select count(*)::int from public.list_contact_phones(
     '20000000-0000-4000-8000-000000000221',
     '20000000-0000-4000-8000-000000000321')),
  0,
  'an outsider cannot read another workspace''s numbers'
);

select throws_ok(
  $$ select public.set_workspace_phone_region(
       '20000000-0000-4000-8000-000000000221','US') $$,
  '42501', 'NOT_A_WORKSPACE_ADMIN',
  'only owners and admins can change the region'
);

reset role;

select * from finish();
rollback;
