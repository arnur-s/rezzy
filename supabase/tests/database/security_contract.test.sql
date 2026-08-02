begin;

select plan(35);

-- Caller-facing helpers must rely on RLS instead of bypassing it.
select ok(
  not (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure('public.is_workspace_member(uuid)')
  ),
  'is_workspace_member runs as the invoker'
);

select ok(
  not (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure('public.mark_conversation_read(uuid,uuid)')
  ),
  'mark_conversation_read runs as the invoker'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure('public.soft_delete_workspace(uuid)')
  ),
  'soft_delete_workspace retains definer rights for its owner-only update'
);

-- Trigger helpers and credential RPCs still need definer rights for their
-- internal writes, but they must not inherit a caller-controlled search path.
with required_definers(signature) as (
  values
    ('public.auto_assign_conversation_on_outbound_message()'),
    ('public.ensure_contact_owner_is_workspace_member()'),
    ('public.get_channel_credentials(uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.handle_inbound_message_insert()'),
    ('public.handle_new_workspace()'),
    ('public.handle_outbound_message_insert()'),
    ('public.list_workspace_members(uuid)'),
    ('public.rls_auto_enable()'),
    ('public.soft_delete_workspace(uuid)'),
    ('public.sync_contact_last_seen()'),
    ('public.upsert_channel_credentials(uuid,jsonb)')
)
select ok(
  not exists (
    select 1
    from required_definers expected
    left join pg_proc p
      on p.oid = to_regprocedure(expected.signature)
    where p.oid is null
      or not p.prosecdef
  ),
  'privileged internal functions retain security definer rights'
);

with empty_search_path_functions(signature) as (
  values
    ('public.auto_assign_conversation_on_outbound_message()'),
    ('public.get_channel_credentials(uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.enforce_contact_note_integrity()'),
    ('public.ensure_contact_owner_is_workspace_member()'),
    ('public.handle_inbound_message_insert()'),
    ('public.handle_new_workspace()'),
    ('public.handle_outbound_message_insert()'),
    ('public.handle_updated_at()'),
    ('public.is_workspace_member(uuid)'),
    ('public.list_workspace_members(uuid)'),
    ('public.mark_conversation_read(uuid,uuid)'),
    ('public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)'),
    ('public.soft_delete_workspace(uuid)'),
    ('public.sync_contact_last_seen()'),
    ('public.upsert_channel_credentials(uuid,jsonb)')
)
select ok(
  not exists (
    select 1
    from empty_search_path_functions expected
    left join pg_proc p
      on p.oid = to_regprocedure(expected.signature)
    where p.oid is null
      or not (
        coalesce(p.proconfig, '{}'::text[])
        @> array['search_path=""']::text[]
      )
  ),
  'hardened functions use an empty search path'
);

select is(
  (
    select array_to_string(p.proconfig, ',')
    from pg_proc p
    where p.oid = to_regprocedure('public.rls_auto_enable()')
  ),
  'search_path=pg_catalog',
  'the RLS event trigger is restricted to pg_catalog'
);

-- Only the documented RPCs are callable through each Data API role.
with user_rpcs(signature) as (
  values
    ('public.is_workspace_member(uuid)'),
    ('public.list_workspace_members(uuid)'),
    ('public.mark_conversation_read(uuid,uuid)'),
    ('public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)')
)
select ok(
  not exists (
    select 1
    from user_rpcs expected
    where to_regprocedure(expected.signature) is null
      or not coalesce(
        has_function_privilege(
          'authenticated',
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'authenticated can execute the user-facing RPCs'
);

with user_rpcs(signature) as (
  values
    ('public.is_workspace_member(uuid)'),
    ('public.list_workspace_members(uuid)'),
    ('public.mark_conversation_read(uuid,uuid)'),
    ('public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)')
)
select ok(
  not exists (
    select 1
    from user_rpcs expected
    where to_regprocedure(expected.signature) is null
      or coalesce(
        has_function_privilege(
          'anon',
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'anon cannot execute authenticated user RPCs'
);

with user_rpcs(signature) as (
  values
    ('public.is_workspace_member(uuid)'),
    ('public.list_workspace_members(uuid)'),
    ('public.mark_conversation_read(uuid,uuid)'),
    ('public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)')
)
select ok(
  not exists (
    select 1
    from user_rpcs expected
    where to_regprocedure(expected.signature) is null
      or coalesce(
        has_function_privilege(
          'service_role',
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'service_role is not granted the user-facing RPCs'
);

select ok(
  to_regprocedure('public.search_conversation_ids(uuid,text)') is null,
  'the unused hosted-only search RPC is absent'
);

with credential_rpcs(signature) as (
  values
    ('public.get_channel_credentials(uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.upsert_channel_credentials(uuid,jsonb)')
)
select ok(
  not exists (
    select 1
    from credential_rpcs expected
    where to_regprocedure(expected.signature) is null
      or not coalesce(
        has_function_privilege(
          'service_role',
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'service_role can execute credential RPCs'
);

with credential_rpcs(signature) as (
  values
    ('public.get_channel_credentials(uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.upsert_channel_credentials(uuid,jsonb)')
)
select ok(
  not exists (
    select 1
    from credential_rpcs expected
    where to_regprocedure(expected.signature) is null
      or coalesce(
        has_function_privilege(
          'authenticated',
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'authenticated cannot execute credential RPCs'
);

with credential_rpcs(signature) as (
  values
    ('public.get_channel_credentials(uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.upsert_channel_credentials(uuid,jsonb)')
)
select ok(
  not exists (
    select 1
    from credential_rpcs expected
    where to_regprocedure(expected.signature) is null
      or coalesce(
        has_function_privilege(
          'anon',
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'anon cannot execute credential RPCs'
);

with internal_functions(signature) as (
  values
    ('public.auto_assign_conversation_on_outbound_message()'),
    ('public.ensure_conversation_assignee_is_workspace_member()'),
    ('public.ensure_message_sender_is_valid()'),
    ('public.enforce_contact_note_integrity()'),
    ('public.handle_inbound_message_insert()'),
    ('public.handle_new_workspace()'),
    ('public.handle_outbound_message_insert()'),
    ('public.handle_updated_at()'),
    ('public.prevent_messages_for_inactive_channels()'),
    ('public.rls_auto_enable()'),
    ('public.soft_delete_workspace(uuid)'),
    ('public.sync_contact_last_seen()')
), api_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
)
select ok(
  not exists (
    select 1
    from internal_functions expected
    cross join api_roles api_role
    where to_regprocedure(expected.signature) is null
      or coalesce(
        has_function_privilege(
          api_role.role_name,
          to_regprocedure(expected.signature),
          'execute'
        ),
        false
      )
  ),
  'Data API roles cannot execute internal mutation or trigger helpers directly'
);

-- Anon has no access to CRM tables.
with exposed_tables(relation_name) as (
  values
    ('public.channels'),
    ('public.contact_channels'),
    ('public.contact_notes'),
    ('public.contacts'),
    ('public.conversation_reads'),
    ('public.conversations'),
    ('public.messages'),
    ('public.profiles'),
    ('public.workspace_members'),
    ('public.workspaces')
), table_privileges(privilege_name) as (
  values
    ('select'),
    ('insert'),
    ('update'),
    ('delete'),
    ('truncate'),
    ('references'),
    ('trigger')
)
select ok(
  not exists (
    select 1
    from exposed_tables expected_table
    cross join table_privileges expected_privilege
    where coalesce(
      has_table_privilege(
        'anon',
        to_regclass(expected_table.relation_name),
        expected_privilege.privilege_name
      ),
      false
    )
  ),
  'anon has no privileges on CRM tables'
);

-- Authenticated grants are deliberately narrower than CRUD where the product
-- has no supported delete/update workflow.
select ok(
  has_table_privilege('authenticated', 'public.channels', 'select')
  and has_table_privilege('authenticated', 'public.channels', 'insert')
  and has_table_privilege('authenticated', 'public.channels', 'update')
  and not has_table_privilege('authenticated', 'public.channels', 'delete')
  and not has_table_privilege('authenticated', 'public.channels', 'truncate')
  and not has_table_privilege('authenticated', 'public.channels', 'references')
  and not has_table_privilege('authenticated', 'public.channels', 'trigger'),
  'authenticated has the exact channels privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.contact_channels', 'select')
  and has_table_privilege('authenticated', 'public.contact_channels', 'insert')
  and has_table_privilege('authenticated', 'public.contact_channels', 'update')
  and has_table_privilege('authenticated', 'public.contact_channels', 'delete')
  and not has_table_privilege('authenticated', 'public.contact_channels', 'truncate')
  and not has_table_privilege('authenticated', 'public.contact_channels', 'references')
  and not has_table_privilege('authenticated', 'public.contact_channels', 'trigger'),
  'authenticated has the exact contact_channels privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.contact_notes', 'select')
  and has_table_privilege('authenticated', 'public.contact_notes', 'insert')
  and has_table_privilege('authenticated', 'public.contact_notes', 'update')
  and has_table_privilege('authenticated', 'public.contact_notes', 'delete')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'truncate')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'references')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'trigger'),
  'authenticated has the exact contact_notes privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.contacts', 'select')
  and has_table_privilege('authenticated', 'public.contacts', 'insert')
  and has_table_privilege('authenticated', 'public.contacts', 'update')
  and has_table_privilege('authenticated', 'public.contacts', 'delete')
  and not has_table_privilege('authenticated', 'public.contacts', 'truncate')
  and not has_table_privilege('authenticated', 'public.contacts', 'references')
  and not has_table_privilege('authenticated', 'public.contacts', 'trigger'),
  'authenticated has the exact contacts privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.conversation_reads', 'select')
  and has_table_privilege('authenticated', 'public.conversation_reads', 'insert')
  and has_table_privilege('authenticated', 'public.conversation_reads', 'update')
  and not has_table_privilege('authenticated', 'public.conversation_reads', 'delete')
  and not has_table_privilege('authenticated', 'public.conversation_reads', 'truncate')
  and not has_table_privilege('authenticated', 'public.conversation_reads', 'references')
  and not has_table_privilege('authenticated', 'public.conversation_reads', 'trigger'),
  'authenticated has the exact conversation_reads privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.conversations', 'select')
  and has_table_privilege('authenticated', 'public.conversations', 'insert')
  and has_table_privilege('authenticated', 'public.conversations', 'update')
  and has_table_privilege('authenticated', 'public.conversations', 'delete')
  and not has_table_privilege('authenticated', 'public.conversations', 'truncate')
  and not has_table_privilege('authenticated', 'public.conversations', 'references')
  and not has_table_privilege('authenticated', 'public.conversations', 'trigger'),
  'authenticated has the exact conversations privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.messages', 'select')
  and has_table_privilege('authenticated', 'public.messages', 'insert')
  and has_table_privilege('authenticated', 'public.messages', 'update')
  and has_table_privilege('authenticated', 'public.messages', 'delete')
  and not has_table_privilege('authenticated', 'public.messages', 'truncate')
  and not has_table_privilege('authenticated', 'public.messages', 'references')
  and not has_table_privilege('authenticated', 'public.messages', 'trigger'),
  'authenticated has the exact messages privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select')
  and has_table_privilege('authenticated', 'public.profiles', 'insert')
  and has_table_privilege('authenticated', 'public.profiles', 'update')
  and not has_table_privilege('authenticated', 'public.profiles', 'delete')
  and not has_table_privilege('authenticated', 'public.profiles', 'truncate')
  and not has_table_privilege('authenticated', 'public.profiles', 'references')
  and not has_table_privilege('authenticated', 'public.profiles', 'trigger'),
  'authenticated has the exact profiles privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.workspace_members', 'select')
  and has_table_privilege('authenticated', 'public.workspace_members', 'insert')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'update')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'delete')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'truncate')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'references')
  and not has_table_privilege('authenticated', 'public.workspace_members', 'trigger'),
  'authenticated has the exact workspace_members privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.workspaces', 'select')
  and not has_table_privilege('authenticated', 'public.workspaces', 'insert')
  and not has_table_privilege('authenticated', 'public.workspaces', 'update')
  and not has_table_privilege('authenticated', 'public.workspaces', 'delete')
  and not has_table_privilege('authenticated', 'public.workspaces', 'truncate')
  and not has_table_privilege('authenticated', 'public.workspaces', 'references')
  and not has_table_privilege('authenticated', 'public.workspaces', 'trigger')
  and has_column_privilege('authenticated', 'public.workspaces', 'name', 'insert')
  and has_column_privilege('authenticated', 'public.workspaces', 'description', 'insert')
  and has_column_privilege('authenticated', 'public.workspaces', 'icon', 'insert')
  and has_column_privilege('authenticated', 'public.workspaces', 'is_main', 'insert')
  and has_column_privilege('authenticated', 'public.workspaces', 'created_by', 'insert')
  and not has_column_privilege('authenticated', 'public.workspaces', 'id', 'insert')
  and not has_column_privilege('authenticated', 'public.workspaces', 'created_at', 'insert')
  and not has_column_privilege('authenticated', 'public.workspaces', 'deleted_at', 'insert')
  and not has_column_privilege('authenticated', 'public.workspaces', 'updated_at', 'insert')
  and not has_column_privilege('authenticated', 'public.workspaces', 'updated_by', 'insert')
  and has_column_privilege('authenticated', 'public.workspaces', 'name', 'update')
  and has_column_privilege('authenticated', 'public.workspaces', 'description', 'update')
  and has_column_privilege('authenticated', 'public.workspaces', 'icon', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'id', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'created_at', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'created_by', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'deleted_at', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'is_main', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'updated_at', 'update')
  and not has_column_privilege('authenticated', 'public.workspaces', 'updated_by', 'update'),
  'authenticated has the exact workspaces privileges'
);

with exposed_tables(relation_name) as (
  values
    ('public.channels'),
    ('public.contact_channels'),
    ('public.contact_notes'),
    ('public.contacts'),
    ('public.conversation_reads'),
    ('public.conversations'),
    ('public.messages'),
    ('public.profiles'),
    ('public.workspace_members'),
    ('public.workspaces')
), table_privileges(privilege_name, should_have) as (
  values
    ('select', true),
    ('insert', true),
    ('update', true),
    ('delete', true),
    ('truncate', false),
    ('references', false),
    ('trigger', false)
)
select ok(
  not exists (
    select 1
    from exposed_tables expected_table
    cross join table_privileges expected_privilege
    where coalesce(
      has_table_privilege(
        'service_role',
        to_regclass(expected_table.relation_name),
        expected_privilege.privilege_name
      ),
      false
    ) is distinct from expected_privilege.should_have
  ),
  'service_role has exact CRUD privileges on CRM tables'
);

-- Exercise the invoker RPCs and workspace trigger under the same role/JWT
-- context used by PostgREST.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000101',
  'security-contract@example.com',
  '{"full_name":"Security contract user"}'::jsonb
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}';

select lives_ok(
  $$
    insert into public.workspaces (name, description, is_main)
    values (
      'Security contract workspace',
      'Created by the pgTAP security contract',
      false
    )
  $$,
  'authenticated users can create a workspace'
);

select results_eq(
  $$
    select wm.role
    from public.workspace_members wm
    where wm.workspace_id = (
      select w.id
      from public.workspaces w
      where w.name = 'Security contract workspace'
    )
      and wm.user_id = '00000000-0000-4000-8000-000000000101'
  $$,
  $$ values ('owner'::text) $$,
  'the workspace trigger creates exactly one owner membership'
);

select lives_ok(
  $$
    update public.workspaces
    set name = 'Security contract workspace updated'
    where name = 'Security contract workspace'
  $$,
  'authenticated users can update an allowed workspace column'
);

select ok(
  public.is_workspace_member((
    select w.id
    from public.workspaces w
    where w.name = 'Security contract workspace updated'
  ))
  and not public.is_workspace_member('00000000-0000-4000-8000-000000000202'),
  'is_workspace_member observes membership through caller RLS'
);

reset role;

insert into public.channels (id, workspace_id, type, name)
values (
  '00000000-0000-4000-8000-000000000301',
  (
    select w.id
    from public.workspaces w
    where w.name = 'Security contract workspace updated'
  ),
  'telegram',
  'Security contract channel'
);

insert into public.contacts (id, workspace_id, name, source)
values (
  '00000000-0000-4000-8000-000000000401',
  (
    select w.id
    from public.workspaces w
    where w.name = 'Security contract workspace updated'
  ),
  'Security contract contact',
  'telegram'
);

insert into public.conversations (
  id,
  workspace_id,
  contact_id,
  channel_id
)
values (
  '00000000-0000-4000-8000-000000000501',
  (
    select w.id
    from public.workspaces w
    where w.name = 'Security contract workspace updated'
  ),
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000301'
);

set local role authenticated;

select lives_ok(
  $$
    select public.mark_conversation_read(
      '00000000-0000-4000-8000-000000000501',
      null
    )
  $$,
  'mark_conversation_read succeeds with invoker RLS'
);

select ok(
  exists (
    select 1
    from public.conversation_reads cr
    where cr.conversation_id = '00000000-0000-4000-8000-000000000501'
      and cr.workspace_id = (
        select w.id
        from public.workspaces w
        where w.name = 'Security contract workspace updated'
      )
      and cr.user_id = '00000000-0000-4000-8000-000000000101'
      and cr.last_read_message_id is null
  ),
  'mark_conversation_read stores the caller''s read cursor'
);

reset role;

-- Probe the default ACL inside this transaction so new public objects must be
-- explicitly granted to Data API roles by future migrations.
create table public.pgtap_default_table_privilege_probe (
  id bigint primary key
);

create sequence public.pgtap_default_sequence_privilege_probe;

create function public.pgtap_default_function_privilege_probe()
returns integer
language sql
as $$
  select 1
$$;

with api_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
), table_privileges(privilege_name) as (
  values
    ('select'),
    ('insert'),
    ('update'),
    ('delete'),
    ('truncate'),
    ('references'),
    ('trigger')
)
select ok(
  not exists (
    select 1
    from api_roles api_role
    cross join table_privileges expected_privilege
    where has_table_privilege(
      api_role.role_name,
      'public.pgtap_default_table_privilege_probe',
      expected_privilege.privilege_name
    )
  ),
  'new public tables are not granted to Data API roles by default'
);

with api_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
), sequence_privileges(privilege_name) as (
  values ('usage'), ('select'), ('update')
)
select ok(
  not exists (
    select 1
    from api_roles api_role
    cross join sequence_privileges expected_privilege
    where has_sequence_privilege(
      api_role.role_name,
      'public.pgtap_default_sequence_privilege_probe',
      expected_privilege.privilege_name
    )
  ),
  'new public sequences are not granted to Data API roles by default'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.pgtap_default_function_privilege_probe()',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.pgtap_default_function_privilege_probe()',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.pgtap_default_function_privilege_probe()',
    'execute'
  ),
  'new public functions are not granted to Data API roles by default'
);

select * from finish();

rollback;
