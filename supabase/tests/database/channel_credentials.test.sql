begin;

select plan(21);

-- Channel credentials live in supabase_vault as ciphertext (20260809100000).
-- What this file has to hold is that the plaintext is *gone*, not merely
-- unread: a passing round trip through the RPCs would look identical if the
-- jsonb column were still there beside it.

-- ── Shape ────────────────────────────────────────────────────────────────────

select hasnt_column(
  'private', 'channel_secrets', 'credentials',
  'the plaintext credentials column is gone'
);

select ok(
  exists (
    select 1
    from pg_attribute a
    where a.attrelid = 'private.channel_secrets'::regclass
      and a.attname = 'secret_id'
      and not a.attisdropped
      and a.attnotnull
  )
  and exists (
    select 1
    from pg_attribute a
    where a.attrelid = 'private.channel_secrets'::regclass
      and a.attname = 'whatsapp_phone_number_id'
      and not a.attisdropped
  ),
  'every row carries a vault secret reference, plus the extracted routing key'
);

select ok(
  to_regprocedure('public.get_channel_credentials(uuid,uuid)') is not null
  and to_regprocedure('public.upsert_channel_credentials(uuid,jsonb,uuid)')
      is not null
  and to_regprocedure(
        'public.finalize_instagram_channel_connection(uuid,text,text,jsonb,uuid)'
      ) is not null
  and to_regprocedure('public.get_channel_credentials(uuid)') is null
  and to_regprocedure('public.upsert_channel_credentials(uuid,jsonb)') is null
  and to_regprocedure(
        'public.finalize_instagram_channel_connection(uuid,text,text,jsonb)'
      ) is null,
  'the credential RPCs carry the workspace parameter and no old arity survives'
);

-- ── Reachability ─────────────────────────────────────────────────────────────

select ok(
  has_function_privilege(
    'service_role', 'public.get_channel_credentials(uuid,uuid)', 'execute'
  )
  and has_function_privilege(
    'service_role', 'public.upsert_channel_credentials(uuid,jsonb,uuid)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.finalize_instagram_channel_connection(uuid,text,text,jsonb,uuid)',
    'execute'
  )
  and has_function_privilege(
    'service_role', 'public.get_whatsapp_channel_by_phone(text)', 'execute'
  ),
  'service_role can execute every credential RPC'
);

with api_roles(role_name) as (
  values ('anon'), ('authenticated')
), credential_rpcs(signature) as (
  values
    ('public.get_channel_credentials(uuid,uuid)'),
    ('public.upsert_channel_credentials(uuid,jsonb,uuid)'),
    ('public.finalize_instagram_channel_connection(uuid,text,text,jsonb,uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)')
)
select ok(
  not exists (
    select 1
    from api_roles api_role
    cross join credential_rpcs expected
    where has_function_privilege(
      api_role.role_name, to_regprocedure(expected.signature), 'execute'
    )
  ),
  'no browser role can execute a credential RPC'
);

-- The RPCs are the only access path, as a privilege rather than a convention.
with api_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
), table_privileges(privilege_name) as (
  values
    ('select'), ('insert'), ('update'), ('delete'),
    ('truncate'), ('references'), ('trigger')
)
select ok(
  not exists (
    select 1
    from api_roles api_role
    cross join table_privileges expected
    where has_table_privilege(
      api_role.role_name,
      'private.channel_secrets'::regclass,
      expected.privilege_name
    )
  ),
  'no Data API role holds any privilege on private.channel_secrets'
);

select ok(
  not has_function_privilege(
    'service_role', 'private.set_channel_credentials(uuid,jsonb)', 'execute'
  ),
  'the internal writer is not callable by a Data API role'
);

-- ── Seed ─────────────────────────────────────────────────────────────────────

insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-0000000000f1',
  'credentials-tap@example.com',
  '{"full_name":"Credentials tap"}'::jsonb
);

insert into public.workspaces (name, is_main, created_by)
values ('CRED WS A', false, '00000000-0000-4000-8000-0000000000f1');

insert into public.workspaces (name, is_main, created_by)
values ('CRED WS B', false, '00000000-0000-4000-8000-0000000000f1');

insert into public.channels (id, workspace_id, type, name)
values
  ('00000000-0000-4000-8000-0000000000e1',
   (select id from public.workspaces where name = 'CRED WS A'),
   'whatsapp', 'WA one'),
  ('00000000-0000-4000-8000-0000000000e2',
   (select id from public.workspaces where name = 'CRED WS A'),
   'whatsapp', 'WA two'),
  ('00000000-0000-4000-8000-0000000000e3',
   (select id from public.workspaces where name = 'CRED WS B'),
   'instagram', 'IG one');

-- ── Round trip ───────────────────────────────────────────────────────────────

select lives_ok(
  $$
    select public.upsert_channel_credentials(
      '00000000-0000-4000-8000-0000000000e1',
      '{"access_token":"PLAINTEXT-WA-TOKEN-9f3c","phone_number_id":"1234567890"}'::jsonb,
      (select id from public.workspaces where name = 'CRED WS A')
    )
  $$,
  'credentials can be stored for a channel in the caller''s workspace'
);

select is(
  public.get_channel_credentials(
    '00000000-0000-4000-8000-0000000000e1',
    (select id from public.workspaces where name = 'CRED WS A')
  ),
  '{"access_token":"PLAINTEXT-WA-TOKEN-9f3c","phone_number_id":"1234567890"}'::jsonb,
  'the RPC returns exactly what was stored'
);

-- ── The point of the exercise ────────────────────────────────────────────────
--
-- The whole row, rendered as text, so a future column that quietly reintroduced
-- the token would fail here rather than pass unnoticed.

select ok(
  (
    select strpos(cs::text, 'PLAINTEXT-WA-TOKEN-9f3c')
    from private.channel_secrets cs
    where cs.channel_id = '00000000-0000-4000-8000-0000000000e1'
  ) = 0,
  'no token material is readable anywhere in the private.channel_secrets row'
);

select ok(
  (
    select strpos(s.secret, 'PLAINTEXT-WA-TOKEN-9f3c')
    from vault.secrets s
    where s.name =
      'channel_credentials:00000000-0000-4000-8000-0000000000e1'
  ) = 0,
  'the stored vault row is ciphertext, not the token'
);

select is(
  (
    select cs.whatsapp_phone_number_id
    from private.channel_secrets cs
    where cs.channel_id = '00000000-0000-4000-8000-0000000000e1'
  ),
  '1234567890',
  'the non-secret routing key is extracted alongside'
);

-- ── Inbound routing still resolves ───────────────────────────────────────────

select results_eq(
  $$
    select channel_id, is_active
    from public.get_whatsapp_channel_by_phone('1234567890')
  $$,
  $$ values ('00000000-0000-4000-8000-0000000000e1'::uuid, true) $$,
  'an inbound WhatsApp webhook still routes to its channel'
);

select is_empty(
  $$ select * from public.get_whatsapp_channel_by_phone('   ') $$,
  'a blank phone_number_id routes nowhere rather than to whichever row sorts first'
);

select throws_ok(
  $$
    select public.upsert_channel_credentials(
      '00000000-0000-4000-8000-0000000000e2',
      '{"access_token":"other","phone_number_id":"1234567890"}'::jsonb,
      (select id from public.workspaces where name = 'CRED WS A')
    )
  $$,
  '23505',
  null,
  'two channels cannot claim the same Meta phone number id'
);

-- ── Workspace assertion ──────────────────────────────────────────────────────

select throws_ok(
  $$
    select public.get_channel_credentials(
      '00000000-0000-4000-8000-0000000000e1',
      (select id from public.workspaces where name = 'CRED WS B')
    )
  $$,
  '42501',
  null,
  'reading a channel''s credentials under the wrong workspace is refused'
);

select throws_ok(
  $$
    select public.upsert_channel_credentials(
      '00000000-0000-4000-8000-0000000000e1',
      '{"access_token":"planted"}'::jsonb,
      (select id from public.workspaces where name = 'CRED WS B')
    )
  $$,
  '42501',
  null,
  'writing a channel''s credentials under the wrong workspace is refused'
);

select throws_ok(
  $$
    select public.finalize_instagram_channel_connection(
      '00000000-0000-4000-8000-0000000000e3',
      'IG_ACCOUNT_1',
      'IG one',
      '{"access_token":"PLAINTEXT-IG-TOKEN-4d21"}'::jsonb,
      (select id from public.workspaces where name = 'CRED WS A')
    )
  $$,
  'P0001',
  null,
  'finalizing an Instagram connection under the wrong workspace is refused'
);

-- ── Rotation ─────────────────────────────────────────────────────────────────

select lives_ok(
  $$
    select public.upsert_channel_credentials(
      '00000000-0000-4000-8000-0000000000e1',
      '{"access_token":"ROTATED-WA-TOKEN-1b77","phone_number_id":"9876543210"}'::jsonb,
      (select id from public.workspaces where name = 'CRED WS A')
    )
  $$,
  'credentials can be rotated in place'
);

select ok(
  public.get_channel_credentials('00000000-0000-4000-8000-0000000000e1')
    ->> 'access_token' = 'ROTATED-WA-TOKEN-1b77'
  and (
    select cs.whatsapp_phone_number_id
    from private.channel_secrets cs
    where cs.channel_id = '00000000-0000-4000-8000-0000000000e1'
  ) = '9876543210'
  and (
    select count(*)
    from vault.secrets s
    where s.name =
      'channel_credentials:00000000-0000-4000-8000-0000000000e1'
  ) = 1,
  'a rotation replaces the secret and the routing key without leaving a second vault row'
);

-- ── Disconnecting a channel must not leave a live token behind ───────────────

delete from public.channels
where id = '00000000-0000-4000-8000-0000000000e1';

select ok(
  not exists (
    select 1
    from private.channel_secrets cs
    where cs.channel_id = '00000000-0000-4000-8000-0000000000e1'
  )
  and not exists (
    select 1
    from vault.secrets s
    where s.name =
      'channel_credentials:00000000-0000-4000-8000-0000000000e1'
  ),
  'deleting a channel takes its vault secret with it'
);

select * from finish();

rollback;
