begin;

select plan(14);

-- Channels are workspace infrastructure. Two boundaries guard them, and this
-- file asserts what each one *refuses*:
--
--   role, in the policy  -- a plain member may read channels and change
--                           nothing; owners and admins may create and
--                           reconfigure them
--   ownership, in the    -- nobody signing in through the browser may write
--   column grants           the routing identity or the webhook health fields,
--                           whatever their role
--
-- Fixture numbering avoids the ranges used by the other files:
--   users …01{41..43}   workspaces …02{41}   channels …04{41,42}

insert into auth.users (id, email, raw_user_meta_data)
values
  ('40000000-0000-4000-8000-000000000141', 'channel-owner@example.com',
   '{"full_name":"Channel Owner"}'::jsonb),
  ('40000000-0000-4000-8000-000000000142', 'channel-admin@example.com',
   '{"full_name":"Channel Admin"}'::jsonb),
  ('40000000-0000-4000-8000-000000000143', 'channel-member@example.com',
   '{"full_name":"Channel Member"}'::jsonb);

insert into public.workspaces (id, name, is_main, created_by)
values ('40000000-0000-4000-8000-000000000241', 'Channel WS', false,
        '40000000-0000-4000-8000-000000000141');

-- on_workspace_created seated the owner; the other two join here.
insert into public.workspace_members (workspace_id, user_id, role)
values
  ('40000000-0000-4000-8000-000000000241',
   '40000000-0000-4000-8000-000000000142', 'admin'),
  ('40000000-0000-4000-8000-000000000241',
   '40000000-0000-4000-8000-000000000143', 'member');

insert into public.channels
  (id, workspace_id, type, name, is_active, provider_account_id,
   last_error_code)
values ('40000000-0000-4000-8000-000000000441',
        '40000000-0000-4000-8000-000000000241', 'instagram', 'Storefront IG',
        true, 'IG_STOREFRONT', 'OAUTH_EXPIRED');

-- ── A plain member: reads everything, writes nothing ─────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000143","role":"authenticated"}';

select is(
  (
    select count(*)::int
    from public.channels
    where workspace_id = '40000000-0000-4000-8000-000000000241'
  ),
  1,
  'a member still reads the workspace channels, which the inbox depends on'
);

-- The UPDATE policy no longer matches the row for this caller, so the statement
-- affects nothing rather than erroring -- the same shape as every other
-- row-filtered write in this schema. The assertion is on the surviving value,
-- because "no error" is not the contract; "no change" is.
update public.channels
set is_active = false
where id = '40000000-0000-4000-8000-000000000441';

select is(
  (
    select is_active
    from public.channels
    where id = '40000000-0000-4000-8000-000000000441'
  ),
  true,
  'a member cannot deactivate a channel and stop delivery for the workspace'
);

update public.channels
set name = 'Renamed by a member'
where id = '40000000-0000-4000-8000-000000000441';

select is(
  (
    select name
    from public.channels
    where id = '40000000-0000-4000-8000-000000000441'
  ),
  'Storefront IG',
  'a member cannot rename a channel'
);

select throws_ok(
  $$
    insert into public.channels (workspace_id, type, name)
    values ('40000000-0000-4000-8000-000000000241', 'telegram',
            'Member-created channel')
  $$,
  '42501',
  null,
  'a member cannot create a channel'
);

-- ── An admin: the writes the product actually offers ─────────────────────────

set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000142","role":"authenticated"}';

select lives_ok(
  $$
    update public.channels
    set name = 'Storefront Instagram'
    where id = '40000000-0000-4000-8000-000000000441'
  $$,
  'an admin can rename a channel'
);

select is(
  (
    select name
    from public.channels
    where id = '40000000-0000-4000-8000-000000000441'
  ),
  'Storefront Instagram',
  'the admin rename is persisted'
);

select lives_ok(
  $$
    update public.channels
    set is_active = false
    where id = '40000000-0000-4000-8000-000000000441'
  $$,
  'an admin can deactivate a channel'
);

select lives_ok(
  $$
    insert into public.channels (workspace_id, type, name)
    values ('40000000-0000-4000-8000-000000000241', 'telegram',
            'Admin-created channel')
  $$,
  'an admin can create a channel'
);

-- ── Provider-owned columns: refused at any role ──────────────────────────────
--
-- These are the connect functions' and the webhooks' to write.
-- provider_account_id is the routing key inbound traffic resolves and is
-- globally unique per type, so a rewrite both detaches this workspace's inbound
-- messages and can squat on an account another workspace has not connected yet.
-- The error is 42501 from the privilege layer, before any policy is consulted:
-- the owner gets it too.

set local request.jwt.claims =
  '{"sub":"40000000-0000-4000-8000-000000000141","role":"authenticated"}';

select throws_ok(
  $$
    update public.channels
    set provider_account_id = 'IG_SOMEBODY_ELSE'
    where id = '40000000-0000-4000-8000-000000000441'
  $$,
  '42501',
  null,
  'not even the owner can rewrite the provider account a channel routes to'
);

select throws_ok(
  $$
    update public.channels
    set last_error_code = null, last_error_at = null, last_webhook_at = now()
    where id = '40000000-0000-4000-8000-000000000441'
  $$,
  '42501',
  null,
  'the owner cannot clear the webhook health fields that report a broken channel'
);

select throws_ok(
  $$
    insert into public.channels (workspace_id, type, name, provider_account_id)
    values ('40000000-0000-4000-8000-000000000241', 'instagram', 'Forged',
            'IG_FORGED')
  $$,
  '42501',
  null,
  'the owner cannot claim a provider account by inserting one'
);

select is(
  (
    select provider_account_id
    from public.channels
    where id = '40000000-0000-4000-8000-000000000441'
  ),
  'IG_STOREFRONT',
  'the routing identity is intact after every attempt above'
);

reset role;

-- ── The paths that legitimately own those columns ────────────────────────────
--
-- The connect functions and the webhooks use service-role clients
-- (`createClient(url, serviceKey)` in supabase/functions/*/index.ts). Column
-- grants to `authenticated` narrow `authenticated` only: service_role keeps the
-- table-wide grant 20260720090850 gave it, and bypasses RLS besides. Asserted
-- rather than assumed, because the whole design above rests on it.

set local role service_role;

select lives_ok(
  $$
    update public.channels
    set provider_account_id = 'IG_ROTATED',
        last_webhook_at = now(),
        last_error_code = null,
        last_error_at = null,
        api_version = 'v21.0'
    where id = '40000000-0000-4000-8000-000000000441'
  $$,
  'service_role still writes the provider columns the webhooks maintain'
);

select is(
  (
    select provider_account_id
    from public.channels
    where id = '40000000-0000-4000-8000-000000000441'
  ),
  'IG_ROTATED',
  'the reconnect path can still repoint a channel at a rotated account'
);

reset role;

select * from finish();

rollback;
