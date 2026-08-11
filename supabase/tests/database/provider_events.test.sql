begin;

select plan(16);

-- ── Schema ───────────────────────────────────────────────────────────────────
select ok(
  to_regclass('public.provider_events') is not null,
  'provider_events exists'
);
select columns_are(
  'public', 'provider_events',
  array[
    'id', 'workspace_id', 'channel_id', 'provider', 'event_type',
    'event_fingerprint', 'payload', 'status', 'error_kind', 'attempts',
    'last_error', 'created_message_id', 'created_record_ids',
    'provider_timestamp', 'claimed_at', 'processed_at', 'created_at'
  ],
  'provider_events has the expected columns'
);

-- ── Service-only access ──────────────────────────────────────────────────────
select ok(
  not has_table_privilege('authenticated', 'public.provider_events', 'select')
  and not has_table_privilege('authenticated', 'public.provider_events', 'insert')
  and not has_table_privilege('anon', 'public.provider_events', 'select'),
  'anon/authenticated have no access to provider_events'
);
select ok(
  has_table_privilege('service_role', 'public.provider_events', 'select')
  and has_table_privilege('service_role', 'public.provider_events', 'insert')
  and has_table_privilege('service_role', 'public.provider_events', 'update'),
  'service_role has full access to provider_events'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.provider_events'::regclass),
  'RLS is enabled on provider_events'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'provider_events'),
  0,
  'provider_events has no RLS policies (deny-all for API roles)'
);
select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'provider_events'),
  0,
  'provider_events is not in the realtime publication'
);

-- ── Seed ─────────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-0000000000e1', 'pe-tap@example.com',
        '{"full_name":"Provider events tap"}'::jsonb);

insert into public.workspaces (name, is_main, created_by)
values ('PE WS', false, '00000000-0000-4000-8000-0000000000e1');

insert into public.channels (id, workspace_id, type, name)
values ('00000000-0000-4000-8000-0000000000f1',
        (select id from public.workspaces where name = 'PE WS'),
        'telegram', 'TG');

-- ── Idempotency: fingerprint uniqueness + claim protocol ─────────────────────
select lives_ok(
  $$ insert into public.provider_events
       (workspace_id, channel_id, provider, event_type, event_fingerprint, payload,
        status, attempts, claimed_at)
     values ((select id from public.workspaces where name = 'PE WS'),
             '00000000-0000-4000-8000-0000000000f1',
             'telegram', 'message', 'update:100', '{"k":"v"}',
             'processing', 1, now()) $$,
  'a logical event can be recorded'
);
select throws_ok(
  $$ insert into public.provider_events
       (workspace_id, channel_id, provider, event_type, event_fingerprint, payload)
     values ((select id from public.workspaces where name = 'PE WS'),
             '00000000-0000-4000-8000-0000000000f1',
             'telegram', 'message', 'update:100', '{}') $$,
  '23505',
  null,
  'duplicate (channel_id, event_fingerprint) is rejected'
);

-- Claim step 1: a duplicate delivery inserts nothing and claims no work.
insert into public.provider_events
  (workspace_id, channel_id, provider, event_type, event_fingerprint, payload,
   status, attempts, claimed_at)
values ((select id from public.workspaces where name = 'PE WS'),
        '00000000-0000-4000-8000-0000000000f1',
        'telegram', 'message', 'update:100', '{}',
        'processing', 1, now())
on conflict (channel_id, event_fingerprint) do nothing;

select is(
  (select count(*)::int from public.provider_events
   where event_fingerprint = 'update:100'),
  1,
  'duplicate delivery claims no row (on conflict do nothing)'
);

-- Claim step 2: a processed event is never reclaimed…
update public.provider_events
set status = 'processed', processed_at = now()
where event_fingerprint = 'update:100';

update public.provider_events
set status = 'processing', attempts = attempts + 1, claimed_at = now()
where channel_id = '00000000-0000-4000-8000-0000000000f1'
  and event_fingerprint = 'update:100'
  and ((status = 'failed' and error_kind = 'temporary')
       or (status = 'processing' and claimed_at < now() - interval '5 minutes'));

select is(
  (select status || ':' || attempts::text from public.provider_events
   where event_fingerprint = 'update:100'),
  'processed:1',
  'a processed event is not reclaimed'
);

-- …but a temporary failure is.
update public.provider_events
set status = 'failed', error_kind = 'temporary', last_error = 'timeout'
where event_fingerprint = 'update:100';

update public.provider_events
set status = 'processing', attempts = attempts + 1, claimed_at = now()
where channel_id = '00000000-0000-4000-8000-0000000000f1'
  and event_fingerprint = 'update:100'
  and ((status = 'failed' and error_kind = 'temporary')
       or (status = 'processing' and claimed_at < now() - interval '5 minutes'));

select is(
  (select status || ':' || attempts::text from public.provider_events
   where event_fingerprint = 'update:100'),
  'processing:2',
  'a temporary failure can be reclaimed for retry'
);

-- ── claim_provider_event RPC ─────────────────────────────────────────────────
select ok(
  to_regprocedure('public.claim_provider_event(uuid,uuid,text,text,text,jsonb,timestamptz)') is not null,
  'claim_provider_event exists'
);
select ok(
  has_function_privilege('service_role',
    'public.claim_provider_event(uuid,uuid,text,text,text,jsonb,timestamptz)', 'execute')
  and not has_function_privilege('authenticated',
    'public.claim_provider_event(uuid,uuid,text,text,text,jsonb,timestamptz)', 'execute')
  and not has_function_privilege('anon',
    'public.claim_provider_event(uuid,uuid,text,text,text,jsonb,timestamptz)', 'execute'),
  'claim_provider_event is service_role-only'
);

select ok(
  (select event_id is not null and duplicate = false
   from public.claim_provider_event(
     (select id from public.workspaces where name = 'PE WS'),
     '00000000-0000-4000-8000-0000000000f1',
     'telegram', 'message', 'update:200', '{"k":1}'::jsonb, null)),
  'the first claim wins and returns the event id'
);
select ok(
  (select event_id is null and duplicate = true
   from public.claim_provider_event(
     (select id from public.workspaces where name = 'PE WS'),
     '00000000-0000-4000-8000-0000000000f1',
     'telegram', 'message', 'update:200', '{"k":1}'::jsonb, null)),
  'a concurrent redelivery is reported as duplicate'
);

select * from finish();

rollback;
