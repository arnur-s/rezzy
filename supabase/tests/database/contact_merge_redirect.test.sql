begin;

select plan(6);

-- public.resolve_merged_contact(p_workspace_id, p_contact_id) is the point
-- lookup behind the detail page's redirect: the contacts SELECT policy hides
-- a merged contact from every ordinary query the instant it becomes one (see
-- 20260810090300's own header), so a stale link to that id has nowhere else to
-- ask "where did this go". What is asserted here: the one case that returns a
-- real value, and the four that must return the exact same null a caller
-- cannot tell apart -- an unknown id, a contact in a different workspace, an
-- ordinary archived contact, a live one, and a caller who is not a member of
-- the workspace at all, even when the contact they named really is merged.
--
-- Fixture numbering avoids every range used by the other files:
--   users …01{01,02,03}  workspaces …0201, …0202
--   contacts …04{01..03} (workspace 1), …05{01,02} (workspace 2)

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000101', 'redirect-owner@example.com',
   '{"full_name":"Redirect Owner"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000102', 'redirect-member@example.com',
   '{"full_name":"Redirect Member"}'::jsonb),
  ('a0000000-0000-4000-8000-000000000103', 'redirect-outsider@example.com',
   '{"full_name":"Redirect Outsider"}'::jsonb);

-- Seeded at the test-runner role: authenticated's insert grant on workspaces
-- excludes id (20260720090850) and these fixtures need fixed ids.
insert into public.workspaces (id, name, is_main, created_by)
values
  ('a0000000-0000-4000-8000-000000000201', 'Redirect WS', false,
   'a0000000-0000-4000-8000-000000000101'),
  -- A second workspace, only to hold a contact that is not in the first --
  -- the cross-workspace assertion below needs a real row to fail to find.
  ('a0000000-0000-4000-8000-000000000202', 'Redirect WS Other', false,
   'a0000000-0000-4000-8000-000000000101');

-- on_workspace_created made the owner's membership in both workspaces; the
-- plain member joins the first only. …103 (the outsider) joins neither -- the
-- point of that fixture is having no membership row in workspace …0201 at
-- all.
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('a0000000-0000-4000-8000-000000000201',
   'a0000000-0000-4000-8000-000000000102', 'member');

insert into public.contacts (id, workspace_id, name, source)
values
  -- The survivor: live, in workspace …0201.
  ('a0000000-0000-4000-8000-000000000401',
   'a0000000-0000-4000-8000-000000000201', 'Redirect Survivor', 'manual'),
  -- An ordinary archived contact: deleted_at set, never merged.
  ('a0000000-0000-4000-8000-000000000403',
   'a0000000-0000-4000-8000-000000000201', 'Redirect Archived', 'manual'),
  -- A live contact in the OTHER workspace, to survive a merge that has
  -- nothing to do with workspace …0201.
  ('a0000000-0000-4000-8000-000000000502',
   'a0000000-0000-4000-8000-000000000202', 'Other Workspace Survivor', 'manual');

update public.contacts
set deleted_at = now()
where id = 'a0000000-0000-4000-8000-000000000403';

-- The two merged losers. Written directly rather than through merge_contacts:
-- this file is about resolve_merged_contact reading the columns, not about
-- the merge itself, which contact_merge.test.sql already covers.
insert into public.contacts
  (id, workspace_id, name, source, deleted_at, merged_into_id, merged_at, merged_by)
values
  ('a0000000-0000-4000-8000-000000000402',
   'a0000000-0000-4000-8000-000000000201', 'Redirect Loser', 'manual',
   now(), 'a0000000-0000-4000-8000-000000000401', now(),
   'a0000000-0000-4000-8000-000000000101'),
  -- Merged for real, but inside workspace …0202. The cross-workspace
  -- assertion below asks for this id under p_workspace_id = …0201: an
  -- implementation missing the `and c.workspace_id = p_workspace_id`
  -- predicate would find this row anyway (ids are globally unique) and
  -- return its real survivor, …0502, instead of null.
  ('a0000000-0000-4000-8000-000000000501',
   'a0000000-0000-4000-8000-000000000202', 'Other Workspace Loser', 'manual',
   now(), 'a0000000-0000-4000-8000-000000000502', now(),
   'a0000000-0000-4000-8000-000000000101');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"a0000000-0000-4000-8000-000000000102","role":"authenticated"}';

-- ── The one case that returns a value ────────────────────────────────────────
--
-- Called as a plain member, deliberately: any member who can open a contact
-- URL should be able to resolve where it went, not only an owner or admin.

select is(
  public.resolve_merged_contact(
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000402'),
  'a0000000-0000-4000-8000-000000000401'::uuid,
  'a merged contact resolves to its survivor'
);

-- ── The cases that all return the same null ──────────────────────────────────

select is(
  public.resolve_merged_contact(
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000403'),
  null,
  'an ordinary archived contact -- never merged -- resolves to null'
);

select is(
  public.resolve_merged_contact(
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000401'),
  null,
  'a live contact resolves to null'
);

select is(
  public.resolve_merged_contact(
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000999'),
  null,
  'an id that names no contact resolves to null, the same as every other refusal'
);

select is(
  public.resolve_merged_contact(
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000501'),
  null,
  'a contact merged in a different workspace resolves to null under this workspace id -- not its real survivor'
);

-- ── A non-member learns nothing, even about a contact that really is merged ──

set local request.jwt.claims =
  '{"sub":"a0000000-0000-4000-8000-000000000103","role":"authenticated"}';

select is(
  public.resolve_merged_contact(
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000402'),
  null,
  'a caller with no membership in the workspace gets null, not an error and not the survivor'
);

select * from finish();
rollback;
