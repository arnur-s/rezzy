begin;

select plan(17);

-- ── Schema ───────────────────────────────────────────────────────────────────
select has_column(
  'public', 'channels', 'provider_account_id',
  'channels.provider_account_id exists'
);
select has_column(
  'public', 'contact_channels', 'channel_id',
  'contact_channels.channel_id exists'
);
select ok(
  to_regclass('private.oauth_states') is not null,
  'private.oauth_states exists'
);
select ok(
  to_regprocedure('public.begin_instagram_oauth(uuid,uuid)') is not null
  and to_regprocedure('public.consume_oauth_state(text,text)') is not null
  and to_regprocedure('public.resolve_instagram_conversation(uuid,text,text,text,text)') is not null
  and to_regprocedure('public.finalize_instagram_channel_connection(uuid,text,text,jsonb,uuid)') is not null
  and to_regprocedure('public.mark_outbound_message_read(uuid,uuid,text)') is not null,
  'Instagram RPCs exist'
);

-- ── Grants ───────────────────────────────────────────────────────────────────
select ok(
  has_function_privilege('authenticated', 'public.begin_instagram_oauth(uuid,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.begin_instagram_oauth(uuid,uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.begin_instagram_oauth(uuid,uuid)', 'execute'),
  'begin_instagram_oauth is authenticated-only'
);
select ok(
  has_function_privilege('service_role', 'public.consume_oauth_state(text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.consume_oauth_state(text,text)', 'execute')
  and not has_function_privilege('anon', 'public.consume_oauth_state(text,text)', 'execute'),
  'consume_oauth_state is service_role-only'
);
select ok(
  has_function_privilege('service_role', 'public.resolve_instagram_conversation(uuid,text,text,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.resolve_instagram_conversation(uuid,text,text,text,text)', 'execute')
  and has_function_privilege('service_role', 'public.finalize_instagram_channel_connection(uuid,text,text,jsonb,uuid)', 'execute')
  and has_function_privilege('service_role', 'public.mark_outbound_message_read(uuid,uuid,text)', 'execute'),
  'ingestion / finalization RPCs are service_role-only'
);

-- ── Seed: two workspaces (via the ownership trigger) ─────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-0000000000a1',
  'ig-tap@example.com',
  '{"full_name":"Instagram tap"}'::jsonb
);

insert into public.workspaces (name, is_main, created_by)
values ('IG WS A', false, '00000000-0000-4000-8000-0000000000a1');

insert into public.workspaces (name, is_main, created_by)
values ('IG WS B', false, '00000000-0000-4000-8000-0000000000a1');

-- Channels (superuser bypasses RLS; specifying ids is allowed here).
insert into public.channels (id, workspace_id, type, provider_account_id, name)
values
  ('00000000-0000-4000-8000-0000000000c1',
   (select id from public.workspaces where name = 'IG WS A'),
   'instagram', 'IG_1', 'A1'),
  ('00000000-0000-4000-8000-0000000000c2',
   (select id from public.workspaces where name = 'IG WS A'),
   'instagram', 'IG_2', 'A2'),
  ('00000000-0000-4000-8000-0000000000c9',
   (select id from public.workspaces where name = 'IG WS B'),
   'instagram', 'IG_9', 'B1');

insert into public.contacts (id, workspace_id, name, source)
values (
  '00000000-0000-4000-8000-0000000000d1',
  (select id from public.workspaces where name = 'IG WS A'),
  'Contact A', 'instagram'
);

-- ── Global provider-account uniqueness ───────────────────────────────────────
select throws_ok(
  $$ insert into public.channels (workspace_id, type, provider_account_id, name)
     values ((select id from public.workspaces where name = 'IG WS B'),
             'instagram', 'IG_1', 'dup') $$,
  '23505',
  null,
  'provider_account_id is globally unique per type (cross-workspace)'
);
select lives_ok(
  $$ insert into public.channels (workspace_id, type, provider_account_id, name)
     values ((select id from public.workspaces where name = 'IG WS A'),
             'instagram', 'IG_4', 'distinct') $$,
  'a distinct Instagram account connects'
);

-- ── contact_channels channel scoping ─────────────────────────────────────────
select throws_ok(
  $$ insert into public.contact_channels
       (contact_id, workspace_id, channel_id, channel_type, external_id)
     values ('00000000-0000-4000-8000-0000000000d1',
             (select id from public.workspaces where name = 'IG WS A'),
             null, 'instagram', 'Y') $$,
  '23502',
  null,
  'new contact_channels must be channel-scoped (NOT NULL column)'
);
select throws_ok(
  $$ insert into public.contact_channels
       (contact_id, workspace_id, channel_id, channel_type, external_id)
     values ('00000000-0000-4000-8000-0000000000d1',
             (select id from public.workspaces where name = 'IG WS A'),
             '00000000-0000-4000-8000-0000000000c9', 'instagram', 'X') $$,
  '23503',
  null,
  'a channel from another workspace cannot be cross-linked'
);
select throws_ok(
  $$ insert into public.contact_channels
       (contact_id, workspace_id, channel_id, channel_type, external_id)
     values ('00000000-0000-4000-8000-0000000000d1',
             (select id from public.workspaces where name = 'IG WS B'),
             '00000000-0000-4000-8000-0000000000c9', 'instagram', 'W') $$,
  '23514',
  null,
  'a contact_channel workspace must match the contact workspace'
);

-- ── Race-safe resolve-or-create ──────────────────────────────────────────────
select public.resolve_instagram_conversation(
  '00000000-0000-4000-8000-0000000000c1', 'SENDER_1', 'sender_one', 'Sender One', null
);
select public.resolve_instagram_conversation(
  '00000000-0000-4000-8000-0000000000c1', 'SENDER_1', 'sender_one', 'Sender One', null
);
select is(
  (select count(*)::int from public.conversations
   where channel_id = '00000000-0000-4000-8000-0000000000c1'),
  1,
  'repeated inbound resolves to a single conversation'
);
select is(
  (select count(*)::int from public.contact_channels
   where channel_id = '00000000-0000-4000-8000-0000000000c1'
     and external_id = 'SENDER_1'),
  1,
  'repeated inbound resolves to a single contact_channel'
);

-- Same Instagram user messaging two connected accounts -> two identities.
select public.resolve_instagram_conversation(
  '00000000-0000-4000-8000-0000000000c1', 'SHARED', null, null, null
);
select public.resolve_instagram_conversation(
  '00000000-0000-4000-8000-0000000000c2', 'SHARED', null, null, null
);
select is(
  (select count(*)::int from public.contact_channels where external_id = 'SHARED'),
  2,
  'the same IG user maps to a distinct identity per connected channel'
);

-- ── One-time OAuth state ─────────────────────────────────────────────────────
insert into private.oauth_states (state, provider, workspace_id, user_id, expires_at)
values (
  'test-state-token',
  'instagram',
  (select id from public.workspaces where name = 'IG WS A'),
  '00000000-0000-4000-8000-0000000000a1',
  now() + interval '5 minutes'
);
select is(
  (select count(*)::int from public.consume_oauth_state('test-state-token', 'instagram')),
  1,
  'consume_oauth_state returns the bound row once'
);
select is(
  (select count(*)::int from public.consume_oauth_state('test-state-token', 'instagram')),
  0,
  'consume_oauth_state is single-use'
);

select * from finish();

rollback;
