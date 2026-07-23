begin;

select plan(11);

-- ── Seed ─────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-0000000000a5', 're-member@example.com',
   '{"full_name":"Reaction member"}'::jsonb),
  ('00000000-0000-4000-8000-0000000000a6', 're-outsider@example.com',
   '{"full_name":"Reaction outsider"}'::jsonb);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
insert into public.workspaces (name, is_main) values ('RE WS', false);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
insert into public.workspaces (name, is_main) values ('RE WS OTHER', false);
reset role;

insert into public.channels (id, workspace_id, type, name)
values ('00000000-0000-4000-8000-0000000000b5',
        (select id from public.workspaces where name = 'RE WS'),
        'telegram', 'TG');

insert into public.contacts (id, workspace_id, name, source)
values ('00000000-0000-4000-8000-0000000000c5',
        (select id from public.workspaces where name = 'RE WS'),
        'Contact', 'telegram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('00000000-0000-4000-8000-0000000000d5',
        (select id from public.workspaces where name = 'RE WS'),
        '00000000-0000-4000-8000-0000000000c5',
        '00000000-0000-4000-8000-0000000000b5');

insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content)
values ('00000000-0000-4000-8000-0000000000e5',
        (select id from public.workspaces where name = 'RE WS'),
        '00000000-0000-4000-8000-0000000000d5',
        '2001', 'inbound', 'text', 'react to me');

-- ── Add / duplicate-callback / remove sequence ───────────────────────────────
insert into public.message_reactions
  (workspace_id, channel_id, conversation_id, message_id, provider_message_id,
   reactor_external_id, emoji, action, provider_timestamp)
values ((select id from public.workspaces where name = 'RE WS'),
        '00000000-0000-4000-8000-0000000000b5',
        '00000000-0000-4000-8000-0000000000d5',
        '00000000-0000-4000-8000-0000000000e5',
        '2001', '555', '👍', 'added', '2026-07-23T10:00:00Z');

select throws_ok(
  $$ insert into public.message_reactions
       (workspace_id, channel_id, conversation_id, message_id, provider_message_id,
        reactor_external_id, emoji, action)
     values ((select id from public.workspaces where name = 'RE WS'),
             '00000000-0000-4000-8000-0000000000b5',
             '00000000-0000-4000-8000-0000000000d5',
             '00000000-0000-4000-8000-0000000000e5',
             '2001', '555', '👍', 'added') $$,
  '23505',
  null,
  'the same reactor+emoji cannot create a second row'
);

-- Duplicate callback: the pipeline upserts; a stale timestamp never wins.
update public.message_reactions
set action = 'removed', provider_timestamp = '2026-07-23T09:59:00Z'
where channel_id = '00000000-0000-4000-8000-0000000000b5'
  and provider_message_id = '2001'
  and reactor_external_id = '555'
  and emoji = '👍'
  and (provider_timestamp is null or provider_timestamp <= '2026-07-23T09:59:00Z');

select is(
  (select action from public.message_reactions
   where provider_message_id = '2001' and reactor_external_id = '555'),
  'added',
  'an out-of-order (older) callback does not flip the reaction state'
);

update public.message_reactions
set action = 'removed', provider_timestamp = '2026-07-23T10:01:00Z'
where channel_id = '00000000-0000-4000-8000-0000000000b5'
  and provider_message_id = '2001'
  and reactor_external_id = '555'
  and emoji = '👍'
  and (provider_timestamp is null or provider_timestamp <= '2026-07-23T10:01:00Z');

select is(
  (select action from public.message_reactions
   where provider_message_id = '2001' and reactor_external_id = '555'),
  'removed',
  'a newer remove callback flips the reaction to removed'
);

select is(
  (select count(*)::int from public.message_reactions
   where provider_message_id = '2001'),
  1,
  'add/remove sequences keep a single audit row per reactor+emoji'
);

-- ── Reaction arriving before its message ─────────────────────────────────────
insert into public.message_reactions
  (workspace_id, channel_id, provider_message_id, reactor_external_id,
   emoji, action, provider_timestamp)
values ((select id from public.workspaces where name = 'RE WS'),
        '00000000-0000-4000-8000-0000000000b5',
        '2002', '555', '❤️', 'added', '2026-07-23T10:02:00Z');

select ok(
  (select message_id is null and conversation_id is null
   from public.message_reactions where provider_message_id = '2002'),
  'a reaction can be stored before its message exists'
);

-- The message arrives; the pipeline backfills pending reactions.
insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content)
values ('00000000-0000-4000-8000-0000000000f5',
        (select id from public.workspaces where name = 'RE WS'),
        '00000000-0000-4000-8000-0000000000d5',
        '2002', 'inbound', 'text', 'late target');

update public.message_reactions
set message_id = '00000000-0000-4000-8000-0000000000f5',
    conversation_id = '00000000-0000-4000-8000-0000000000d5'
where channel_id = '00000000-0000-4000-8000-0000000000b5'
  and provider_message_id = '2002'
  and message_id is null;

select is(
  (select message_id from public.message_reactions
   where provider_message_id = '2002'),
  '00000000-0000-4000-8000-0000000000f5'::uuid,
  'pending reactions are backfilled once the message arrives'
);

-- WhatsApp-style replace: same reactor, different emoji = separate audit rows.
insert into public.message_reactions
  (workspace_id, channel_id, conversation_id, message_id, provider_message_id,
   reactor_external_id, emoji, action, provider_timestamp)
values ((select id from public.workspaces where name = 'RE WS'),
        '00000000-0000-4000-8000-0000000000b5',
        '00000000-0000-4000-8000-0000000000d5',
        '00000000-0000-4000-8000-0000000000e5',
        '2001', '555', '😀', 'added', '2026-07-23T10:03:00Z');

select is(
  (select count(*)::int from public.message_reactions
   where provider_message_id = '2001' and reactor_external_id = '555'),
  2,
  'replacing an emoji keeps one row per emoji (old removed, new added)'
);

-- ── Access contract ──────────────────────────────────────────────────────────
select ok(
  has_table_privilege('authenticated', 'public.message_reactions', 'select')
  and not has_table_privilege('authenticated', 'public.message_reactions', 'insert')
  and not has_table_privilege('anon', 'public.message_reactions', 'select'),
  'authenticated can read but never write reactions'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
select is(
  (select count(*)::int from public.message_reactions),
  3,
  'workspace members see their workspace reactions'
);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
select is(
  (select count(*)::int from public.message_reactions),
  0,
  'outsiders see no reactions'
);
reset role;

select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'message_reactions'),
  1,
  'message_reactions is in the realtime publication'
);

select * from finish();

rollback;
