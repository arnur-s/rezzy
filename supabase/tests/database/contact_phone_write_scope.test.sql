begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('82000000-0000-4000-8000-000000000001', 'phone-scope-owner@example.com', '{"full_name":"Owner"}'),
  ('82000000-0000-4000-8000-000000000002', 'phone-scope-outsider@example.com', '{"full_name":"Outsider"}');

insert into public.workspaces (id, name, created_by)
values ('82000000-0000-4000-8000-000000000003', 'Phone scope',
        '82000000-0000-4000-8000-000000000001');

insert into public.contacts (id, workspace_id, name, phone)
values ('82000000-0000-4000-8000-000000000004',
        '82000000-0000-4000-8000-000000000003', 'Archived customer', '+77011234567');
insert into public.contact_phones (workspace_id, contact_id, phone, position)
values ('82000000-0000-4000-8000-000000000003',
        '82000000-0000-4000-8000-000000000004', '+77011234567', 0);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"82000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.set_contact_phones('82000000-0000-4000-8000-000000000003',
       '82000000-0000-4000-8000-000000000004', array[]::text[]) $$,
  'P0002', 'CONTACT_NOT_FOUND', 'an outsider cannot clear the contact phone set'
);
select throws_ok(
  $$ select public.set_contact_phones('82000000-0000-4000-8000-000000000003',
       '82000000-0000-4000-8000-000000000099', array[]::text[]) $$,
  'P0002', 'CONTACT_NOT_FOUND', 'a missing contact has the same response as an inaccessible one'
);

set local request.jwt.claims =
  '{"sub":"82000000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.archive_contact('82000000-0000-4000-8000-000000000004');
select throws_ok(
  $$ select public.set_contact_phones('82000000-0000-4000-8000-000000000003',
       '82000000-0000-4000-8000-000000000004', array[]::text[]) $$,
  'P0002', 'CONTACT_NOT_FOUND', 'a stale form cannot delete an archived contact phone set'
);

reset role;
select is(
  (select phone from public.contact_phones where contact_id = '82000000-0000-4000-8000-000000000004'),
  '+77011234567', 'the archived contact retains its phone child'
);
select is(
  (select phone from public.contacts where id = '82000000-0000-4000-8000-000000000004'),
  '+77011234567', 'the parent primary remains consistent with its saved set'
);

select * from finish();
rollback;
