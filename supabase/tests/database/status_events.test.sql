begin;

select plan(13);

-- ── Seed ─────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-0000000000a3', 'se-member@example.com',
   '{"full_name":"Status member"}'::jsonb),
  ('00000000-0000-4000-8000-0000000000a4', 'se-outsider@example.com',
   '{"full_name":"Status outsider"}'::jsonb);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
insert into public.workspaces (name, is_main) values ('SE WS', false);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
insert into public.workspaces (name, is_main) values ('SE WS OTHER', false);
reset role;

insert into public.channels (id, workspace_id, type, name)
values ('00000000-0000-4000-8000-0000000000b3',
        (select id from public.workspaces where name = 'SE WS'),
        'whatsapp', 'WA');

insert into public.contacts (id, workspace_id, name, source)
values ('00000000-0000-4000-8000-0000000000c3',
        (select id from public.workspaces where name = 'SE WS'),
        'Contact', 'whatsapp');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('00000000-0000-4000-8000-0000000000d3',
        (select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000c3',
        '00000000-0000-4000-8000-0000000000b3');

-- reset role keeps the transaction-scoped jwt claims; align auth.uid() with the
-- outbound sender so ensure_message_sender_is_valid accepts the seed inserts.
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}';

insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content,
   sender_id, status)
values ('00000000-0000-4000-8000-0000000000e3',
        (select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000d3',
        'wamid.1', 'outbound', 'text', 'hi',
        '00000000-0000-4000-8000-0000000000a3', 'sent');

-- ── Out-of-order callbacks never regress the latest status ───────────────────
insert into public.message_status_events
  (workspace_id, message_id, status, provider_timestamp)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000e3',
        'read', '2026-07-23T10:02:00Z');

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000e3'),
  'read',
  'a read receipt advances the latest status'
);

insert into public.message_status_events
  (workspace_id, message_id, status, provider_timestamp)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000e3',
        'delivered', '2026-07-23T10:01:00Z');

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000e3'),
  'read',
  'a late delivered callback does not regress read'
);

insert into public.message_status_events
  (workspace_id, message_id, status, provider_timestamp)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000e3',
        'played', '2026-07-23T10:03:00Z');

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000e3'),
  'played',
  'played (voice) advances beyond read'
);

insert into public.message_status_events
  (workspace_id, message_id, status)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000e3',
        'failed');

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000e3'),
  'played',
  'failed never overrides a read/played message'
);

-- History keeps every event even when the projection ignores them.
select is(
  (select count(*)::int from public.message_status_events
   where message_id = '00000000-0000-4000-8000-0000000000e3'),
  4,
  'every status callback is preserved in history'
);

-- ── failed is terminal for a not-yet-read message ────────────────────────────
insert into public.messages
  (id, workspace_id, conversation_id, external_id, direction, type, content,
   sender_id, status)
values ('00000000-0000-4000-8000-0000000000f3',
        (select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000d3',
        'wamid.2', 'outbound', 'text', 'hi again',
        '00000000-0000-4000-8000-0000000000a3', 'sent');

insert into public.message_status_events
  (workspace_id, message_id, status, error_code, error_subcode, trace_id, retryable)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000f3',
        'failed', '131026', '2494010', 'AbCdEf123', false);

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000f3'),
  'failed',
  'failed applies to an unread message'
);

insert into public.message_status_events
  (workspace_id, message_id, status, provider_timestamp)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000f3',
        'delivered', '2026-07-23T10:05:00Z');

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000f3'),
  'failed',
  'a stale delivered callback does not resurrect a failed message'
);

select ok(
  (select error_code = '131026' and trace_id = 'AbCdEf123'
   from public.message_status_events
   where message_id = '00000000-0000-4000-8000-0000000000f3'
     and status = 'failed'),
  'failure events persist safe provider error diagnostics'
);

-- ── Idempotent direct writers ────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.message_status_events
       (workspace_id, message_id, status, provider_timestamp)
     values ((select id from public.workspaces where name = 'SE WS'),
             '00000000-0000-4000-8000-0000000000e3',
             'read', '2026-07-23T10:02:00Z') $$,
  '23505',
  null,
  'the same provider-timestamped status cannot be double-inserted'
);

-- ── Statuses history-only vocabulary never touches messages.status ───────────
insert into public.message_status_events
  (workspace_id, message_id, status)
values ((select id from public.workspaces where name = 'SE WS'),
        '00000000-0000-4000-8000-0000000000f3',
        'unknown');

select is(
  (select status from public.messages
   where id = '00000000-0000-4000-8000-0000000000f3'),
  'failed',
  'unknown statuses are history-only'
);

-- ── Access contract ──────────────────────────────────────────────────────────
select ok(
  has_table_privilege('authenticated', 'public.message_status_events', 'select')
  and not has_table_privilege('authenticated', 'public.message_status_events', 'insert')
  and not has_table_privilege('anon', 'public.message_status_events', 'select'),
  'authenticated can read but never write status events'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
select is(
  (select count(*)::int from public.message_status_events
   where message_id = '00000000-0000-4000-8000-0000000000e3'),
  4,
  'workspace members see their workspace status history'
);
reset role;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
select is(
  (select count(*)::int from public.message_status_events),
  0,
  'outsiders see no status events'
);
reset role;

select * from finish();

rollback;
