begin;
select plan(17);

select ok(
  has_function_privilege('authenticated', 'public.save_contact(uuid,jsonb,uuid,text[])', 'execute')
  and not has_function_privilege('anon', 'public.save_contact(uuid,jsonb,uuid,text[])', 'execute')
  and not has_function_privilege('service_role', 'public.save_contact(uuid,jsonb,uuid,text[])', 'execute')
  and not (select prosecdef from pg_proc where oid = 'public.save_contact(uuid,jsonb,uuid,text[])'::regprocedure),
  'contact saves retain authenticated invoker rights and RLS'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('84000000-0000-4000-8000-000000000001', 'atomic-owner@example.com', '{"full_name":"Owner"}'),
  ('84000000-0000-4000-8000-000000000002', 'atomic-other@example.com', '{"full_name":"Other"}');
insert into public.workspaces (id, name, created_by) values
  ('84000000-0000-4000-8000-000000000003', 'Atomic workspace', '84000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000004', 'Other workspace', '84000000-0000-4000-8000-000000000002');
insert into public.contacts (id, workspace_id, name) values
  ('84000000-0000-4000-8000-000000000005', '84000000-0000-4000-8000-000000000004', 'Other contact');

-- A real second-stage database failure, after the parent insert/update has
-- executed. The trigger exists only inside this rolled-back test transaction.
create function pg_temp.reject_test_phone() returns trigger language plpgsql as $$
begin
  if new.phone = '99999' then
    raise exception 'PHONE_WRITE_FAILED';
  end if;
  return new;
end;
$$;
create trigger reject_test_phone before insert or update on public.contact_phones
for each row execute function pg_temp.reject_test_phone();

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"84000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is(
  public.save_contact('84000000-0000-4000-8000-000000000003',
    '{"name":"Atomic contact","phone":"+77011111111","status":"new","tags":[]}',
    null, array['+77011111111','+77012222222']) -> 'contact_channels',
  '[]'::jsonb, 'a create returns its detail shape in the same transaction'
);
select is(
  (select count(*)::integer from public.contact_phones where contact_id =
    (select id from public.contacts where name = 'Atomic contact')),
  2, 'the complete phone set was committed with the contact'
);
select is(
  (select phone from public.contacts where name = 'Atomic contact'),
  '+77011111111', 'the returned primary agrees with the phone set'
);

select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000003',
       '{"name":"Must roll back"}', null, array['99999']) $$,
  'P0001', 'PHONE_WRITE_FAILED', 'a phone failure rejects the whole create'
);
select is((select count(*)::integer from public.contacts where name = 'Must roll back'),
  0, 'a failed create leaves no duplicate candidate for a retry');

select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000003',
       '{"name":"Must roll back"}',
       (select id from public.contacts where name = 'Atomic contact'), array['99999']) $$,
  'P0001', 'PHONE_WRITE_FAILED', 'a phone failure rejects the whole update'
);
select is((select count(*)::integer from public.contacts where name = 'Atomic contact'),
  1, 'the scalar edit was rolled back with the phone failure');
select is(
  (select string_agg(phone, ',' order by position) from public.contact_phones where contact_id =
    (select id from public.contacts where name = 'Atomic contact')),
  '+77011111111,+77012222222', 'a failed update retains the old complete phone set'
);

select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000004',
       '{"name":"Unauthorized"}', '84000000-0000-4000-8000-000000000005', array[]::text[]) $$,
  'P0002', 'CONTACT_NOT_FOUND', 'cross-workspace updates cannot reach the contact or its phones'
);
select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000004', '{"name":"Unauthorized"}') $$,
  '42501', null, 'cross-workspace creates are rejected by RLS'
);
select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000003', '{"deleted_at":"2026-01-01"}') $$,
  '22023', 'INVALID_CONTACT_FIELDS', 'caller-controlled fields cannot bypass the write allowlist'
);

-- Even membership in both workspaces cannot make a mismatched workspace/id
-- pair target a contact. This checks identity scoping separately from RLS.
reset role;
insert into public.workspace_members (workspace_id, user_id, role) values
  ('84000000-0000-4000-8000-000000000004', '84000000-0000-4000-8000-000000000001', 'member');
set local role authenticated;
select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000003',
       '{"name":"Wrong workspace"}', '84000000-0000-4000-8000-000000000005', array[]::text[]) $$,
  'P0002', 'CONTACT_NOT_FOUND', 'membership in both workspaces does not bypass the supplied workspace identity'
);
select is((select name from public.contacts where id = '84000000-0000-4000-8000-000000000005'),
  'Other contact', 'the contact in the other workspace remains unchanged');

select is(
  public.save_contact('84000000-0000-4000-8000-000000000003', '{"status":"done"}',
    (select id from public.contacts where name = 'Atomic contact')) ->> 'phone',
  '+77011111111', 'a scalar-only edit preserves the existing phone set'
);
select is(
  public.save_contact('84000000-0000-4000-8000-000000000003', '{}',
    (select id from public.contacts where name = 'Atomic contact'), array[]::text[]) ->> 'phone',
  null, 'an explicitly empty phone set clears the primary atomically'
);
select set_config('test.atomic_contact_id', (select id::text from public.contacts where name = 'Atomic contact'), true);
select public.archive_contact(current_setting('test.atomic_contact_id')::uuid);
select throws_ok(
  $$ select public.save_contact('84000000-0000-4000-8000-000000000003', '{}',
       current_setting('test.atomic_contact_id')::uuid) $$,
  'P0002', 'CONTACT_NOT_FOUND', 'an archived contact cannot be edited by a stale form'
);

select * from finish();
rollback;
