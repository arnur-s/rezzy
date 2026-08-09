begin;

select plan(6);

-- Task 1 covers the columns, the merged-is-archived invariant and the
-- restore refusal. Tasks 2 and 3 append to this plan count.
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

select * from finish();
rollback;
