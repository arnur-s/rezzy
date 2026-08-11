begin;

select plan(27);

-- What happens to a workspace and its people over time: the name it may carry,
-- what a soft delete withdraws, whether a replacement can be created, and what
-- is left behind when somebody is removed from the roster.
--
-- Fixture numbering avoids the ranges used by the other files:
--   users …01{51..53}   workspaces …02{51..53}   channels …04{51..53}
--   contacts …03{51,52} conversations …05{51}    messages …06{51}

insert into auth.users (id, email, raw_user_meta_data)
values
  ('50000000-0000-4000-8000-000000000151', 'lifecycle-owner@example.com',
   '{"full_name":"Lifecycle Owner"}'::jsonb),
  ('50000000-0000-4000-8000-000000000152', 'lifecycle-member@example.com',
   '{"full_name":"Lifecycle Member"}'::jsonb),
  ('50000000-0000-4000-8000-000000000153', 'lifecycle-onboarder@example.com',
   '{"full_name":"Lifecycle Onboarder"}'::jsonb);

-- ── The name a workspace may carry ───────────────────────────────────────────
--
-- complete_onboarding validates 2-60 characters, but authenticated also holds
-- insert("name")/update("name") column grants and the create/rename forms use
-- them directly, so the RPC's validation was not the boundary it looked like.

select throws_ok(
  $$
    insert into public.workspaces (name, created_by)
    values ('a', '50000000-0000-4000-8000-000000000151')
  $$,
  '23514',
  null,
  'a one-character workspace name is refused by the table, not just by the RPC'
);

select throws_ok(
  $$
    insert into public.workspaces (name, created_by)
    values ('   ', '50000000-0000-4000-8000-000000000151')
  $$,
  '23514',
  null,
  'a whitespace-only name is refused: the check reads the trimmed value'
);

select throws_ok(
  $$
    insert into public.workspaces (name, created_by)
    values (repeat('x', 61), '50000000-0000-4000-8000-000000000151')
  $$,
  '23514',
  null,
  'a name past 60 characters is refused'
);

select lives_ok(
  $$
    insert into public.workspaces (id, name, is_main, created_by)
    values ('50000000-0000-4000-8000-000000000251', '  Lifecycle WS  ', true,
            '50000000-0000-4000-8000-000000000151')
  $$,
  'surrounding whitespace is still storable; only an empty result is not'
);

select throws_ok(
  $$
    update public.workspaces
    set name = ''
    where id = '50000000-0000-4000-8000-000000000251'
  $$,
  '23514',
  null,
  'a rename cannot empty the name either'
);

-- ── A workspace with a team and its work ─────────────────────────────────────

insert into public.workspace_members (workspace_id, user_id, role)
values ('50000000-0000-4000-8000-000000000251',
        '50000000-0000-4000-8000-000000000152', 'member');

insert into public.channels (id, workspace_id, type, name)
values ('50000000-0000-4000-8000-000000000451',
        '50000000-0000-4000-8000-000000000251', 'telegram', 'Lifecycle TG');

insert into public.contacts (id, workspace_id, name, source, owner_id)
values ('50000000-0000-4000-8000-000000000351',
        '50000000-0000-4000-8000-000000000251', 'Lifecycle Contact', 'telegram',
        '50000000-0000-4000-8000-000000000152');

insert into public.conversations (id, workspace_id, contact_id, channel_id,
                                  assigned_to)
values ('50000000-0000-4000-8000-000000000551',
        '50000000-0000-4000-8000-000000000251',
        '50000000-0000-4000-8000-000000000351',
        '50000000-0000-4000-8000-000000000451',
        '50000000-0000-4000-8000-000000000152');

insert into public.messages
  (id, workspace_id, conversation_id, direction, type, content)
values ('50000000-0000-4000-8000-000000000651',
        '50000000-0000-4000-8000-000000000251',
        '50000000-0000-4000-8000-000000000551',
        'inbound', 'text', 'Lifecycle inbound');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000152","role":"authenticated"}';

select ok(
  public.is_workspace_member('50000000-0000-4000-8000-000000000251')
  and (select count(*) from public.messages) = 1
  and (select count(*) from public.channels) = 1,
  'the member reads the workspace and its messages while it is live'
);

reset role;

-- ── The webhook ingress, while the workspace is live ─────────────────────────
--
-- Every provider webhook runs as service_role, where RLS -- and therefore
-- is_workspace_member() -- never executes, so the delete has to be visible to
-- the lookups themselves. Seeded after the count assertions above so those keep
-- reading one channel.

insert into public.channels (id, workspace_id, type, name)
values
  ('50000000-0000-4000-8000-000000000452',
   '50000000-0000-4000-8000-000000000251', 'whatsapp', 'Lifecycle WA'),
  ('50000000-0000-4000-8000-000000000453',
   '50000000-0000-4000-8000-000000000251', 'instagram', 'Lifecycle IG');

select public.upsert_channel_credentials(
  '50000000-0000-4000-8000-000000000452',
  '{"access_token":"lifecycle-wa-token","phone_number_id":"5551110000"}'::jsonb,
  '50000000-0000-4000-8000-000000000251'
);

select results_eq(
  $$
    select channel_id from public.get_whatsapp_channel_by_phone('5551110000')
  $$,
  $$ values ('50000000-0000-4000-8000-000000000452'::uuid) $$,
  'an inbound WhatsApp webhook routes to its channel while the workspace is live'
);

select lives_ok(
  $$
    select public.resolve_instagram_conversation(
      '50000000-0000-4000-8000-000000000453', 'LIFECYCLE_SENDER',
      null, null, null
    )
  $$,
  'an inbound Instagram webhook resolves a conversation while the workspace is live'
);

-- ── Soft delete withdraws the whole workspace, not just its own row ──────────
--
-- soft_delete_workspace is REVOKEd from PUBLIC and never granted to
-- authenticated, so it is called here the only way it can be called today:
-- at the owning role, with the caller's claims in place so its auth.uid()
-- ownership check is the thing being exercised. It lives in private
-- (20260809190000), which is what keeps it out of the Data API and out of
-- src/api/types.ts; that move changes neither the grant nor this call site's
-- reasoning.

set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000152","role":"authenticated"}';

select throws_ok(
  $$ select private.soft_delete_workspace('50000000-0000-4000-8000-000000000251') $$,
  '42501',
  'Not authorized',
  'a plain member cannot delete the workspace'
);

set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000151","role":"authenticated"}';

select lives_ok(
  $$ select private.soft_delete_workspace('50000000-0000-4000-8000-000000000251') $$,
  'the owner can soft delete the workspace'
);

select ok(
  (
    select deleted_at is not null and not is_main
    from public.workspaces
    where id = '50000000-0000-4000-8000-000000000251'
  ),
  'the delete stamps deleted_at and releases the per-creator main slot'
);

-- Memberships are retained on purpose: restoration is a single flag flip, and
-- is_workspace_member is what withdraws access in the meantime.
select is(
  (
    select count(*)::int
    from public.workspace_members
    where workspace_id = '50000000-0000-4000-8000-000000000251'
  ),
  2,
  'the roster survives the delete, so a restore does not have to rebuild it'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000152","role":"authenticated"}';

select ok(
  not public.is_workspace_member('50000000-0000-4000-8000-000000000251'),
  'membership of a deleted workspace no longer counts'
);

-- The point of putting the check in is_workspace_member: every child table
-- authorises through it, so they all stop together rather than one policy at a
-- time. A deep link to any of these rows now returns nothing.
select ok(
  (select count(*) from public.channels) = 0
  and (select count(*) from public.contacts) = 0
  and (select count(*) from public.conversations) = 0
  and (select count(*) from public.messages) = 0
  and (select count(*) from public.workspaces) = 0,
  'contacts, conversations, messages and channels all go with the workspace'
);

select throws_ok(
  $$
    insert into public.contacts (workspace_id, name, source)
    values ('50000000-0000-4000-8000-000000000251', 'Written after deletion',
            'telegram')
  $$,
  '42501',
  null,
  'writes into a deleted workspace are refused, not merely hidden'
);

reset role;

-- ── …and the service-role paths stop with them ───────────────────────────────
--
-- Without these two joins the webhooks kept creating contacts, conversations
-- and messages in a workspace nobody could read, for as long as the provider
-- kept delivering. Channels are deliberately left active: is_active describes
-- the provider connection, not the workspace, and overwriting it would make a
-- restore guess which channels had been switched off on purpose. 20260809120000
-- has the reasoning.

select is_empty(
  $$ select * from public.get_whatsapp_channel_by_phone('5551110000') $$,
  'an inbound WhatsApp webhook routes nowhere once the workspace is deleted'
);

select throws_ok(
  $$
    select public.resolve_instagram_conversation(
      '50000000-0000-4000-8000-000000000453', 'LIFECYCLE_SENDER_2',
      null, null, null
    )
  $$,
  'P0001',
  'unknown or unavailable Instagram channel 50000000-0000-4000-8000-000000000453',
  'an inbound Instagram webhook cannot create a conversation in a deleted workspace'
);

select ok(
  (
    select is_active
    from public.channels
    where id = '50000000-0000-4000-8000-000000000452'
  ),
  'the channel itself is untouched, so a restore stays a single flag flip'
);

-- ── Archive and restore go with the workspace too ────────────────────────────
--
-- Both read workspace_members directly for the owner/admin check and omitted
-- the join to workspaces that their sibling list_archived_contacts carries.

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000151","role":"authenticated"}';

select throws_ok(
  $$ select public.archive_contact('50000000-0000-4000-8000-000000000351') $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'the owner cannot archive a contact in the workspace they deleted'
);

select throws_ok(
  $$ select public.restore_contact('50000000-0000-4000-8000-000000000351') $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'nor restore one'
);

reset role;

-- ── Creating a replacement main workspace ────────────────────────────────────
--
-- one_main_workspace_per_user is UNIQUE (created_by) WHERE is_main, and it
-- ignored deleted_at: the deleted workspace held the slot for ever, so a
-- replacement raised 23505 and onboarding's unique_violation handler could hand
-- back the workspace the user had just deleted.

select lives_ok(
  $$
    insert into public.workspaces (id, name, is_main, created_by)
    values ('50000000-0000-4000-8000-000000000252', 'Lifecycle WS II', true,
            '50000000-0000-4000-8000-000000000151')
  $$,
  'the creator can make a new main workspace after deleting the old one'
);

-- A row deleted before the is_main clearing shipped: deleted_at set, is_main
-- still true. The partial index has to exclude it on its own.
update public.workspaces
set is_main = true
where id = '50000000-0000-4000-8000-000000000251';

select is(
  (
    select count(*)::int
    from public.workspaces
    where created_by = '50000000-0000-4000-8000-000000000151'
      and is_main
  ),
  2,
  'a legacy deleted-but-still-main row coexists with its live replacement'
);

-- ── Onboarding after a delete ────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000153","role":"authenticated"}';

select results_eq(
  $$ select is_new from public.complete_onboarding('First Workspace') $$,
  $$ values (true) $$,
  'the onboarder gets a workspace'
);

reset role;
update public.workspaces
set deleted_at = now()
where created_by = '50000000-0000-4000-8000-000000000153';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"50000000-0000-4000-8000-000000000153","role":"authenticated"}';

select results_eq(
  $$ select is_new from public.complete_onboarding('Second Workspace') $$,
  $$ values (true) $$,
  'onboarding after a delete builds a new workspace instead of raising 23505'
);

select is(
  (
    select w.name
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id
    where wm.user_id = '50000000-0000-4000-8000-000000000153'
      and w.deleted_at is null
  ),
  'Second Workspace',
  'and it is the new workspace that is returned, not the deleted one'
);

reset role;

-- ── Removing somebody from the roster ────────────────────────────────────────
--
-- Reachable from the browser since 20260809180000, through
-- public.remove_workspace_member. This file still exercises the raw DELETE,
-- because what it is testing is the trigger beneath that RPC:
-- contacts.owner_id and conversations.assigned_to are guarded on write against
-- the roster, and nothing re-checked them when the roster changed underneath.
-- The RPC's own authorization is covered in workspace_membership.test.sql.

select is(
  (
    select count(*)::int
    from public.conversations
    where id = '50000000-0000-4000-8000-000000000551'
      and assigned_to = '50000000-0000-4000-8000-000000000152'
  ),
  1,
  'the departing member holds an assignment before they are removed'
);

delete from public.workspace_members
where workspace_id = '50000000-0000-4000-8000-000000000251'
  and user_id = '50000000-0000-4000-8000-000000000152';

select ok(
  (
    select assigned_to is null
    from public.conversations
    where id = '50000000-0000-4000-8000-000000000551'
  )
  and (
    select owner_id is null
    from public.contacts
    where id = '50000000-0000-4000-8000-000000000351'
  ),
  'removal clears the conversations they were assigned and the contacts they owned'
);

select * from finish();

rollback;
