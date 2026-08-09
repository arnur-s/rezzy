begin;

select plan(14);

-- ── Seed: one workspace, telegram channel, contact, conversation ─────────────
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-0000000000a2', 'mp-tap@example.com',
        '{"full_name":"Message pipeline tap"}'::jsonb);

insert into public.workspaces (name, is_main, created_by)
values ('MP WS', false, '00000000-0000-4000-8000-0000000000a2');

insert into public.channels (id, workspace_id, type, name)
values ('00000000-0000-4000-8000-0000000000b2',
        (select id from public.workspaces where name = 'MP WS'),
        'telegram', 'TG');

insert into public.contacts (id, workspace_id, name, source)
values ('00000000-0000-4000-8000-0000000000c2',
        (select id from public.workspaces where name = 'MP WS'),
        'Contact', 'telegram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('00000000-0000-4000-8000-0000000000d2',
        (select id from public.workspaces where name = 'MP WS'),
        '00000000-0000-4000-8000-0000000000c2',
        '00000000-0000-4000-8000-0000000000b2');

-- ── New message types are accepted; junk is rejected ─────────────────────────
select lives_ok(
  $$ insert into public.messages
       (workspace_id, conversation_id, direction, type, content, metadata)
     values ((select id from public.workspaces where name = 'MP WS'),
             '00000000-0000-4000-8000-0000000000d2',
             'inbound', 'location', null,
             '{"location":{"kind":"point","latitude":51.1,"longitude":71.4}}') $$,
  'location messages are accepted'
);
select lives_ok(
  $$ insert into public.messages
       (workspace_id, conversation_id, direction, type, content)
     values ((select id from public.workspaces where name = 'MP WS'),
             '00000000-0000-4000-8000-0000000000d2',
             'inbound', 'unsupported', null) $$,
  'unsupported messages are accepted'
);
select throws_ok(
  $$ insert into public.messages
       (workspace_id, conversation_id, direction, type)
     values ((select id from public.workspaces where name = 'MP WS'),
             '00000000-0000-4000-8000-0000000000d2',
             'inbound', 'reaction') $$,
  '23514',
  null,
  'reactions are not messages (type rejected)'
);

-- ── Non-text preview fallback + last_inbound_at ──────────────────────────────
select is(
  (select last_message_preview from public.conversations
   where id = '00000000-0000-4000-8000-0000000000d2'),
  'Unsupported message',
  'non-text inbound sets a useful conversation preview'
);
select ok(
  (select last_inbound_at is not null from public.conversations
   where id = '00000000-0000-4000-8000-0000000000d2'),
  'inbound messages maintain conversations.last_inbound_at'
);

-- ── Duplicate webhook delivery: idempotent, no double side effects ───────────
insert into public.messages
  (workspace_id, conversation_id, external_id, direction, type, content)
values ((select id from public.workspaces where name = 'MP WS'),
        '00000000-0000-4000-8000-0000000000d2',
        '1001', 'inbound', 'text', 'hello');

select is(
  (select count(*)::int from public.message_notifications
   where conversation_id = '00000000-0000-4000-8000-0000000000d2'),
  3,
  'each inbound message fans out one notification per member (3 messages, 1 member)'
);

select throws_ok(
  $$ insert into public.messages
       (workspace_id, conversation_id, external_id, direction, type, content)
     values ((select id from public.workspaces where name = 'MP WS'),
             '00000000-0000-4000-8000-0000000000d2',
             '1001', 'inbound', 'text', 'dup') $$,
  '23505',
  null,
  'duplicate provider message id is rejected by messages_unique_external_id'
);

-- The pipeline inserts with ON CONFLICT DO NOTHING: no row, no triggers.
insert into public.messages
  (workspace_id, conversation_id, external_id, direction, type, content)
values ((select id from public.workspaces where name = 'MP WS'),
        '00000000-0000-4000-8000-0000000000d2',
        '1001', 'inbound', 'text', 'dup-preview')
on conflict (workspace_id, conversation_id, external_id)
  where external_id is not null
  do nothing;

select is(
  (select count(*)::int from public.messages where external_id = '1001'),
  1,
  'duplicate insert with on conflict do nothing creates no row'
);
select is(
  (select count(*)::int from public.message_notifications
   where conversation_id = '00000000-0000-4000-8000-0000000000d2'),
  3,
  'a skipped duplicate does not fan out extra notifications'
);
select is(
  (select last_message_preview from public.conversations
   where id = '00000000-0000-4000-8000-0000000000d2'),
  'hello',
  'a skipped duplicate does not touch the conversation preview'
);

-- ── Per-agent unread does not double-count duplicates ────────────────────────
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is(
  (select unread_count from public.get_workspace_unread_counts(
     (select id from public.workspaces where name = 'MP WS'))
   where conversation_id = '00000000-0000-4000-8000-0000000000d2'),
  3,
  'unread reflects the three real messages, not duplicate deliveries'
);
reset role;

-- ── Replies: internal FK + late-parent backfill ──────────────────────────────
insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content,
   external_reply_to_id)
values ('00000000-0000-4000-8000-0000000000e2',
        (select id from public.workspaces where name = 'MP WS'),
        '00000000-0000-4000-8000-0000000000d2',
        '1003', 'inbound', 'text', 'child reply', '1002');

select ok(
  (select reply_to_message_id is null from public.messages
   where id = '00000000-0000-4000-8000-0000000000e2'),
  'a reply to a missing parent is stored with only the external target'
);

-- Parent arrives late; the pipeline backfills children.
insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content)
values ('00000000-0000-4000-8000-0000000000f2',
        (select id from public.workspaces where name = 'MP WS'),
        '00000000-0000-4000-8000-0000000000d2',
        '1002', 'inbound', 'text', 'late parent');

update public.messages
set reply_to_message_id = '00000000-0000-4000-8000-0000000000f2'
where conversation_id = '00000000-0000-4000-8000-0000000000d2'
  and external_reply_to_id = '1002'
  and reply_to_message_id is null;

select is(
  (select reply_to_message_id from public.messages
   where id = '00000000-0000-4000-8000-0000000000e2'),
  '00000000-0000-4000-8000-0000000000f2'::uuid,
  'late-arriving parents are backfilled into reply_to_message_id'
);

-- Deleting the parent clears the pointer without losing the reply.
delete from public.messages where id = '00000000-0000-4000-8000-0000000000f2';
select ok(
  (select reply_to_message_id is null and content = 'child reply'
   from public.messages
   where id = '00000000-0000-4000-8000-0000000000e2'),
  'deleting a parent nulls the reply pointer and keeps the reply'
);

select * from finish();

rollback;
