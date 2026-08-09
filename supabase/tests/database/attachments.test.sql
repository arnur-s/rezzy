begin;

select plan(9);

-- ── Seed: two workspaces with one message each ───────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-0000000000a7', 'at-member@example.com',
   '{"full_name":"Attachment member"}'::jsonb),
  ('00000000-0000-4000-8000-0000000000a8', 'at-outsider@example.com',
   '{"full_name":"Attachment outsider"}'::jsonb);

insert into public.workspaces (name, is_main, created_by)
values ('AT WS', false, '00000000-0000-4000-8000-0000000000a7');

insert into public.workspaces (name, is_main, created_by)
values ('AT WS OTHER', false, '00000000-0000-4000-8000-0000000000a8');

insert into public.channels (id, workspace_id, type, name)
values ('00000000-0000-4000-8000-0000000000b7',
        (select id from public.workspaces where name = 'AT WS'),
        'instagram', 'IG');

insert into public.contacts (id, workspace_id, name, source)
values ('00000000-0000-4000-8000-0000000000c7',
        (select id from public.workspaces where name = 'AT WS'),
        'Contact', 'instagram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('00000000-0000-4000-8000-0000000000d7',
        (select id from public.workspaces where name = 'AT WS'),
        '00000000-0000-4000-8000-0000000000c7',
        '00000000-0000-4000-8000-0000000000b7');

insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content)
values ('00000000-0000-4000-8000-0000000000e7',
        (select id from public.workspaces where name = 'AT WS'),
        '00000000-0000-4000-8000-0000000000d7',
        'mid.1', 'inbound', 'image', null);

-- ── Multiple attachments per message ─────────────────────────────────────────
insert into public.message_attachments
  (workspace_id, message_id, position, kind, storage_path, mime_type,
   download_status)
values
  ((select id from public.workspaces where name = 'AT WS'),
   '00000000-0000-4000-8000-0000000000e7',
   0, 'image', 'ws/conv/msg/a.jpg', 'image/jpeg', 'stored'),
  ((select id from public.workspaces where name = 'AT WS'),
   '00000000-0000-4000-8000-0000000000e7',
   1, 'video', null, 'video/mp4', 'failed');

select is(
  (select count(*)::int from public.message_attachments
   where message_id = '00000000-0000-4000-8000-0000000000e7'),
  2,
  'a message can carry multiple attachments'
);

select throws_ok(
  $$ insert into public.message_attachments
       (workspace_id, message_id, position, kind)
     values ((select id from public.workspaces where name = 'AT WS'),
             '00000000-0000-4000-8000-0000000000e7',
             0, 'image') $$,
  '23505',
  null,
  'duplicate (message_id, position) is rejected'
);

select throws_ok(
  $$ insert into public.message_attachments
       (workspace_id, message_id, position, kind, download_status)
     values ((select id from public.workspaces where name = 'AT WS'),
             '00000000-0000-4000-8000-0000000000e7',
             2, 'image', 'downloaded') $$,
  '23514',
  null,
  'invalid download states are rejected'
);

-- A failed attachment keeps its diagnosis without rejecting the message.
select ok(
  (select download_status = 'failed' and storage_path is null
   from public.message_attachments
   where message_id = '00000000-0000-4000-8000-0000000000e7' and position = 1),
  'failed downloads persist as failed attachment state'
);

-- ── Cascade with the parent message ──────────────────────────────────────────
insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content)
values ('00000000-0000-4000-8000-0000000000f7',
        (select id from public.workspaces where name = 'AT WS'),
        '00000000-0000-4000-8000-0000000000d7',
        'mid.2', 'inbound', 'image', null);

insert into public.message_attachments
  (workspace_id, message_id, position, kind)
values ((select id from public.workspaces where name = 'AT WS'),
        '00000000-0000-4000-8000-0000000000f7', 0, 'image');

delete from public.messages where id = '00000000-0000-4000-8000-0000000000f7';

select is(
  (select count(*)::int from public.message_attachments
   where message_id = '00000000-0000-4000-8000-0000000000f7'),
  0,
  'attachments cascade with their message'
);

-- ── Access contract ──────────────────────────────────────────────────────────
select ok(
  has_table_privilege('authenticated', 'public.message_attachments', 'select')
  and not has_table_privilege('authenticated', 'public.message_attachments', 'insert')
  and not has_table_privilege('anon', 'public.message_attachments', 'select'),
  'authenticated can read but never write attachments'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a7","role":"authenticated"}';
select is(
  (select count(*)::int from public.message_attachments),
  2,
  'workspace members see their workspace attachments'
);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a8","role":"authenticated"}';
select is(
  (select count(*)::int from public.message_attachments),
  0,
  'outsiders see no attachments'
);
reset role;

select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'message_attachments'),
  1,
  'message_attachments is in the realtime publication'
);

select * from finish();

rollback;
