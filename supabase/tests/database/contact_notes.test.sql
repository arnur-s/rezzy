begin;

select plan(39);

-- Contract for collaborative notes on contacts. The production migration does not
-- exist yet; until it does, this file should fail RED with relation
-- "public.contact_notes" does not exist.

-- ── Shape / security metadata ─────────────────────────────────────────────────
select has_table('public', 'contact_notes', 'contact_notes table exists');
select row_security_active('public.contact_notes', 'contact_notes has RLS enabled');

select has_column('public', 'contact_notes', 'id', 'contact_notes has id');
select has_column('public', 'contact_notes', 'workspace_id', 'contact_notes has workspace_id');
select has_column('public', 'contact_notes', 'contact_id', 'contact_notes has contact_id');
select has_column('public', 'contact_notes', 'author_id', 'contact_notes has author_id');
select has_column('public', 'contact_notes', 'author_name', 'contact_notes snapshots author_name');
select has_column('public', 'contact_notes', 'body', 'contact_notes has body');
select has_column('public', 'contact_notes', 'is_pinned', 'contact_notes has is_pinned');
select has_column('public', 'contact_notes', 'created_at', 'contact_notes has created_at');
select has_column('public', 'contact_notes', 'updated_at', 'contact_notes has updated_at');

select col_not_null('public', 'contact_notes', 'workspace_id', 'workspace_id is required');
select col_not_null('public', 'contact_notes', 'contact_id', 'contact_id is required');
select col_is_null('public', 'contact_notes', 'author_id', 'author_id is nullable so notes survive profile deletion');
select col_is_null('public', 'contact_notes', 'author_name', 'author_name is nullable so historical imports can omit the snapshot');
select col_not_null('public', 'contact_notes', 'body', 'body is required');
select col_not_null('public', 'contact_notes', 'is_pinned', 'is_pinned is required');

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'contact_notes_body_length_check'
      and conrelid = 'public.contact_notes'::regclass
      and contype = 'c'
  ),
  'note bodies are capped at 5000 characters by a check constraint'
);

select policies_are(
  'public',
  'contact_notes',
  array[
    'Workspace members can view contact notes',
    'Workspace members can create contact notes',
    'Workspace members can update contact note pins and own content',
    'Authors and workspace admins can delete contact notes'
  ],
  'contact_notes exposes only the intended RLS policies'
);

select has_index(
  'public',
  'contact_notes',
  'contact_notes_contact_order_idx',
  'contact notes can be listed by contact in stable order'
);

select has_index(
  'public',
  'contact_notes',
  'contact_notes_author_id_idx',
  'contact notes can be filtered by author efficiently'
);

-- ── Fixtures ──────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '20000000-0000-4000-8000-000000000101',
    'notes-owner@example.com',
    '{"full_name":"Notes Owner"}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000102',
    'notes-admin@example.com',
    '{"full_name":"Notes Admin"}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000103',
    'notes-member@example.com',
    '{"full_name":"Notes Member"}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000104',
    'notes-outsider@example.com',
    '{"full_name":"Notes Outsider"}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000105',
    'notes-removed-author@example.com',
    '{"full_name":"Removed Author"}'::jsonb
  );

insert into public.workspaces (id, name, description, is_main, created_by)
values
  (
    '20000000-0000-4000-8000-000000000201',
    'Contact notes contract workspace',
    'Created by the pgTAP contact notes contract',
    false,
    '20000000-0000-4000-8000-000000000101'
  ),
  (
    '20000000-0000-4000-8000-000000000202',
    'Contact notes other workspace',
    'Created by the pgTAP contact notes contract',
    false,
    '20000000-0000-4000-8000-000000000104'
  );

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000102',
    'admin'
  ),
  (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000103',
    'member'
  ),
  (
    '20000000-0000-4000-8000-000000000201',
    '20000000-0000-4000-8000-000000000105',
    'member'
  );

insert into public.contacts (id, workspace_id, name, source)
values
  (
    '20000000-0000-4000-8000-000000000301',
    '20000000-0000-4000-8000-000000000201',
    'Primary notes contact',
    'manual'
  ),
  (
    '20000000-0000-4000-8000-000000000302',
    '20000000-0000-4000-8000-000000000202',
    'Other workspace contact',
    'manual'
  );

-- ── Create / spoofing / read scope ────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000103","role":"authenticated"}';

insert into public.contact_notes (
  id, workspace_id, contact_id, author_id, author_name, body
)
values (
  '20000000-0000-4000-8000-000000000401',
  '20000000-0000-4000-8000-000000000202',
  '20000000-0000-4000-8000-000000000301',
  '20000000-0000-4000-8000-000000000104',
  'Spoofed Author',
  'Member-created note'
);

select is(
  (
    select count(*)::int
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000401'
  ),
  1,
  'a workspace member can create a contact note'
);

select results_eq(
  $$
    select workspace_id::text, author_id::text, author_name, body, is_pinned
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000401'
  $$,
  $$
    values (
      '20000000-0000-4000-8000-000000000201',
      '20000000-0000-4000-8000-000000000103',
      'Notes Member',
      'Member-created note',
      false
    )
  $$,
  'workspace, author, and author-name snapshot are derived by the database, not client input'
);

select throws_ok(
  $$
    insert into public.contact_notes (contact_id, body)
    values (
      '20000000-0000-4000-8000-000000000399',
      'Missing contact note attempt'
    )
  $$,
  '23503',
  null,
  'contact notes must reference an existing contact'
);

select throws_ok(
  $$
    insert into public.contact_notes (contact_id, body)
    values (
      '20000000-0000-4000-8000-000000000302',
      'Cross-workspace note attempt'
    )
  $$,
  '23503',
  'CONTACT_NOTE_CONTACT_NOT_FOUND',
  'a member cannot create a note for a contact in another workspace'
);

select is(
  (
    select count(*)::int
    from public.contact_notes
    where contact_id = '20000000-0000-4000-8000-000000000301'
  ),
  1,
  'workspace members can read notes for contacts in their workspace'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000104","role":"authenticated"}';

select is(
  (
    select count(*)::int
    from public.contact_notes
    where contact_id = '20000000-0000-4000-8000-000000000301'
  ),
  0,
  'non-members cannot read notes from another workspace'
);

select throws_ok(
  $$
    insert into public.contact_notes (contact_id, body)
    values (
      '20000000-0000-4000-8000-000000000301',
      'Outsider cross-workspace note attempt'
    )
  $$,
  '23503',
  'CONTACT_NOTE_CONTACT_NOT_FOUND',
  'an outsider cannot create a note in a workspace they do not belong to'
);

-- ── Update authorization ──────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000103","role":"authenticated"}';

update public.contact_notes
set body = 'Author edited body'
where id = '20000000-0000-4000-8000-000000000401';

select is(
  (
    select body
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000401'
  ),
  'Author edited body',
  'the author can edit their note body'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000102","role":"authenticated"}';

select throws_ok(
  $$
    update public.contact_notes
    set body = 'Admin attempted body overwrite'
    where id = '20000000-0000-4000-8000-000000000401'
  $$,
  '42501',
  'CONTACT_NOTE_BODY_AUTHOR_ONLY',
  'non-authors cannot edit note bodies'
);

update public.contact_notes
set is_pinned = true
where id = '20000000-0000-4000-8000-000000000401';

select ok(
  (
    select is_pinned
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000401'
  ),
  'workspace members can collaboratively pin notes'
);

select throws_ok(
  $$
    update public.contact_notes
    set
      id = '20000000-0000-4000-8000-000000000499',
      workspace_id = '20000000-0000-4000-8000-000000000202',
      contact_id = '20000000-0000-4000-8000-000000000302',
      author_id = '20000000-0000-4000-8000-000000000102',
      author_name = 'Mutated Author Snapshot',
      created_at = now() + interval '1 day'
    where id = '20000000-0000-4000-8000-000000000401'
  $$,
  '23514',
  'CONTACT_NOTE_IDENTITY_IMMUTABLE',
  'note identity fields and the author snapshot are immutable after insert'
);

select throws_ok(
  $$
    update public.contact_notes
    set body = repeat('x', 5001)
    where id = '20000000-0000-4000-8000-000000000401'
  $$,
  '23514',
  null,
  'note bodies cannot exceed 5000 characters'
);

select throws_ok(
  $$
    insert into public.contact_notes (contact_id, body)
    values (
      '20000000-0000-4000-8000-000000000301',
      '   '
    )
  $$,
  '23514',
  null,
  'note bodies cannot be empty or whitespace only'
);

-- ── Delete authorization ──────────────────────────────────────────────────────
insert into public.contact_notes (id, contact_id, body)
values (
  '20000000-0000-4000-8000-000000000402',
  '20000000-0000-4000-8000-000000000301',
  'Author-delete candidate'
);

delete from public.contact_notes
where id = '20000000-0000-4000-8000-000000000402';

select is(
  (
    select count(*)::int
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000402'
  ),
  0,
  'authors can delete their own notes'
);

insert into public.contact_notes (id, contact_id, body)
values (
  '20000000-0000-4000-8000-000000000403',
  '20000000-0000-4000-8000-000000000301',
  'Ordinary member delete candidate'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000105","role":"authenticated"}';

delete from public.contact_notes
where id = '20000000-0000-4000-8000-000000000403';

select is(
  (
    select count(*)::int
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000403'
  ),
  1,
  'ordinary members cannot delete notes written by another author'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000102","role":"authenticated"}';

delete from public.contact_notes
where id = '20000000-0000-4000-8000-000000000403';

select is(
  (
    select count(*)::int
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000403'
  ),
  0,
  'workspace admins can delete notes written by others'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000103","role":"authenticated"}';

insert into public.contact_notes (id, contact_id, body)
values (
  '20000000-0000-4000-8000-000000000404',
  '20000000-0000-4000-8000-000000000301',
  'Owner-delete candidate'
);

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000101","role":"authenticated"}';

delete from public.contact_notes
where id = '20000000-0000-4000-8000-000000000404';

select is(
  (
    select count(*)::int
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000404'
  ),
  0,
  'workspace owners can delete notes written by others'
);

-- ── Author profile removal ────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000105","role":"authenticated"}';

insert into public.contact_notes (id, contact_id, body)
values (
  '20000000-0000-4000-8000-000000000405',
  '20000000-0000-4000-8000-000000000301',
  'Profile-removal survival candidate'
);

reset role;
delete from auth.users
where id = '20000000-0000-4000-8000-000000000105';

select results_eq(
  $$
    select id::text, author_id is null, author_name, body
    from public.contact_notes
    where id = '20000000-0000-4000-8000-000000000405'
  $$,
  $$
    values (
      '20000000-0000-4000-8000-000000000405',
      true,
      'Removed Author',
      'Profile-removal survival candidate'
    )
  $$,
  'deleting a non-owner author profile preserves the note and its author-name snapshot'
);

select * from finish();

rollback;
