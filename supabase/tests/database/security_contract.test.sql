begin;

select plan(55);

-- Caller-facing helpers must rely on RLS instead of bypassing it, with one
-- documented exception.
--
-- is_workspace_member holds definer rights because 20260805090300 made it read
-- public.workspaces for the soft-delete check, and the workspaces SELECT policy
-- calls is_workspace_member. As the invoker that recurses through the policy
-- until the stack limit -- and only for members who did not create the
-- workspace, because a creator short-circuits on the created_by branch first.
-- The reads are pinned to (select auth.uid()) and to the workspace passed in,
-- so the boolean it returns still describes nobody but the caller.
select ok(
  (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure('public.is_workspace_member(uuid)')
  ),
  'is_workspace_member holds definer rights so its workspaces read cannot recurse'
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
    ('public.enforce_contact_note_integrity()'),
    ('public.ensure_contact_owner_is_workspace_member()'),
    ('public.ensure_conversation_assignee_is_workspace_member()'),
    ('public.ensure_message_sender_is_valid()'),
    ('public.get_channel_credentials(uuid,uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.handle_inbound_message_insert()'),
    ('public.handle_new_workspace()'),
    ('public.handle_outbound_message_insert()'),
    ('public.list_workspace_members(uuid)'),
    ('public.rls_auto_enable()'),
    -- default_phone_region is deliberately absent from authenticated's update
    -- grant, so this RPC is the only writer and needs rights the caller lacks.
    ('public.set_workspace_phone_region(uuid,text)'),
    ('public.soft_delete_workspace(uuid)'),
    ('public.sync_contact_last_seen()'),
    ('public.upsert_channel_credentials(uuid,jsonb,uuid)')
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
    ('public.get_channel_credentials(uuid,uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.enforce_contact_note_integrity()'),
    ('public.ensure_contact_owner_is_workspace_member()'),
    ('public.ensure_conversation_assignee_is_workspace_member()'),
    ('public.ensure_message_sender_is_valid()'),
    ('public.handle_inbound_message_insert()'),
    ('public.handle_new_workspace()'),
    ('public.handle_outbound_message_insert()'),
    ('public.handle_updated_at()'),
    ('public.is_workspace_member(uuid)'),
    ('public.list_workspace_members(uuid)'),
    ('public.mark_conversation_read(uuid,uuid)'),
    ('public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)'),
    ('public.set_workspace_phone_region(uuid,text)'),
    ('public.soft_delete_workspace(uuid)'),
    ('public.sync_contact_last_seen()'),
    ('public.upsert_channel_credentials(uuid,jsonb,uuid)')
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
    ('public.get_channel_credentials(uuid,uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.upsert_channel_credentials(uuid,jsonb,uuid)')
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
    ('public.get_channel_credentials(uuid,uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.upsert_channel_credentials(uuid,jsonb,uuid)')
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
    ('public.get_channel_credentials(uuid,uuid)'),
    ('public.get_whatsapp_channel_by_phone(text)'),
    ('public.upsert_channel_credentials(uuid,jsonb,uuid)')
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

-- The browser writes messages and notes through column grants, not a
-- table-wide privilege. Provenance stays with the provider round trip and with
-- the trigger that stamps authorship; a member cannot reach either.
with locked_message_columns(column_name) as (
  values
    ('direction'),
    ('sender_id'),
    ('conversation_id'),
    ('workspace_id'),
    ('content'),
    ('external_id'),
    ('external_reply_to_id'),
    ('provider_timestamp'),
    ('metadata'),
    ('created_at'),
    ('edited_at'),
    ('deleted_at')
)
select ok(
  not exists (
    select 1
    from locked_message_columns locked
    where has_column_privilege(
      'authenticated',
      'public.messages'::regclass,
      locked.column_name,
      'update'
    )
  ),
  'a member cannot update message direction, provenance or history columns'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.messages'::regclass,
    'status',
    'update'
  ),
  'a member can still update message status, which is what send retry needs'
);

with locked_message_insert_columns(column_name) as (
  values
    ('external_id'),
    ('external_reply_to_id'),
    ('provider_timestamp'),
    ('metadata'),
    ('created_at'),
    ('edited_at'),
    ('deleted_at')
)
select ok(
  not exists (
    select 1
    from locked_message_insert_columns locked
    where has_column_privilege(
      'authenticated',
      'public.messages'::regclass,
      locked.column_name,
      'insert'
    )
  ),
  'a member cannot manufacture provider identifiers or backdate a message'
);

with locked_note_columns(column_name) as (
  values
    ('id'),
    ('workspace_id'),
    ('contact_id'),
    ('author_id'),
    ('author_name'),
    ('created_at')
)
select ok(
  not exists (
    select 1
    from locked_note_columns locked
    where has_column_privilege(
      'authenticated',
      'public.contact_notes'::regclass,
      locked.column_name,
      'update'
    )
  ),
  'a member cannot rewrite contact note identity or authorship'
);

select ok(
  has_column_privilege(
    'authenticated',
    'public.contact_notes'::regclass,
    'body',
    'update'
  )
  and has_column_privilege(
    'authenticated',
    'public.contact_notes'::regclass,
    'is_pinned',
    'update'
  ),
  'a member can still edit note bodies and pin collaboratively'
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
-- channels: writes are column grants, so has_table_privilege is false for
-- insert and update even though both are still possible on the granted
-- columns. The provider-owned columns are the point of the exercise -- they
-- belong to the connect functions and the webhooks, which run as service_role
-- and keep their table-wide grant.
select ok(
  has_table_privilege('authenticated', 'public.channels', 'select')
  and not has_table_privilege('authenticated', 'public.channels', 'insert')
  and not has_table_privilege('authenticated', 'public.channels', 'update')
  and not has_table_privilege('authenticated', 'public.channels', 'delete')
  and not has_table_privilege('authenticated', 'public.channels', 'truncate')
  and not has_table_privilege('authenticated', 'public.channels', 'references')
  and not has_table_privilege('authenticated', 'public.channels', 'trigger')
  and has_any_column_privilege('authenticated', 'public.channels', 'insert')
  and has_any_column_privilege('authenticated', 'public.channels', 'update'),
  'authenticated has the exact channels privileges'
);

with locked_channel_columns(column_name) as (
  values
    ('provider_account_id'),
    ('api_version'),
    ('last_webhook_at'),
    ('last_outbound_at'),
    ('last_error_at'),
    ('last_error_code'),
    ('id'),
    ('workspace_id'),
    ('type'),
    ('created_at'),
    ('updated_at')
), write_privileges(privilege_name) as (
  values ('insert'), ('update')
)
select ok(
  not exists (
    select 1
    from locked_channel_columns locked
    cross join write_privileges privilege
    where has_column_privilege(
      'authenticated',
      'public.channels'::regclass,
      locked.column_name,
      privilege.privilege_name
    )
      -- workspace_id and type are insertable (a channel has to be created
      -- somewhere, as something); neither may be rewritten afterwards.
      and not (
        privilege.privilege_name = 'insert'
        and locked.column_name in ('workspace_id', 'type')
      )
  ),
  'a member cannot write channel routing identity or webhook health columns'
);

select ok(
  has_column_privilege(
    'authenticated', 'public.channels'::regclass, 'name', 'update'
  )
  and has_column_privilege(
    'authenticated', 'public.channels'::regclass, 'is_active', 'update'
  ),
  'an admin can still rename a channel and toggle it, which is what the UI does'
);

select ok(
  to_regprocedure('public.auto_assign_conversation_on_outbound_message()')
    is null
  and not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.messages'::regclass
      and tgname = 'trg_auto_assign_conversation_on_outbound_message'
  ),
  'the duplicate outbound assign trigger and its function are gone'
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

-- Like channels and messages: insert and update are column grants since
-- 20260804090100, so the table-level privilege is gone while the write is not.
select ok(
  has_table_privilege('authenticated', 'public.contact_notes', 'select')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'insert')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'update')
  and has_any_column_privilege('authenticated', 'public.contact_notes', 'insert')
  and has_any_column_privilege('authenticated', 'public.contact_notes', 'update')
  and has_table_privilege('authenticated', 'public.contact_notes', 'delete')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'truncate')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'references')
  and not has_table_privilege('authenticated', 'public.contact_notes', 'trigger'),
  'authenticated has the exact contact_notes privileges'
);

-- DELETE went with the archive change (20260808090000): "delete" now means
-- archive, through an admin-guarded RPC. UPDATE became a column grant in
-- 20260809090000, and the column list is the assertion -- workspace_id absent
-- from it is what stops a member of two workspaces moving a contact between
-- them, so has_any_column_privilege would not be checking anything.
select ok(
  has_table_privilege('authenticated', 'public.contacts', 'select')
  and has_table_privilege('authenticated', 'public.contacts', 'insert')
  and not has_table_privilege('authenticated', 'public.contacts', 'update')
  and has_any_column_privilege('authenticated', 'public.contacts', 'update')
  and not has_table_privilege('authenticated', 'public.contacts', 'delete')
  and not has_table_privilege('authenticated', 'public.contacts', 'truncate')
  and not has_table_privilege('authenticated', 'public.contacts', 'references')
  and not has_table_privilege('authenticated', 'public.contacts', 'trigger')
  and (
    select array_agg(a.attname::text order by a.attname::text)
    from pg_attribute a
    where a.attrelid = 'public.contacts'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')
  ) = array['email', 'name', 'owner_id', 'phone', 'status', 'tags'],
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

-- Same two changes, and here the column list is the whole cross-workspace fix:
-- channel_id absent from it is what stops a member of workspace A repointing a
-- conversation at workspace B's channel and sending on B's credentials.
select ok(
  has_table_privilege('authenticated', 'public.conversations', 'select')
  and has_table_privilege('authenticated', 'public.conversations', 'insert')
  and not has_table_privilege('authenticated', 'public.conversations', 'update')
  and has_any_column_privilege('authenticated', 'public.conversations', 'update')
  and not has_table_privilege('authenticated', 'public.conversations', 'delete')
  and not has_table_privilege('authenticated', 'public.conversations', 'truncate')
  and not has_table_privilege('authenticated', 'public.conversations', 'references')
  and not has_table_privilege('authenticated', 'public.conversations', 'trigger')
  and (
    select array_agg(a.attname::text order by a.attname::text)
    from pg_attribute a
    where a.attrelid = 'public.conversations'::regclass
      and a.attnum > 0
      and not a.attisdropped
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'update')
  ) = array['assigned_to', 'status'],
  'authenticated has the exact conversations privileges'
);

select ok(
  has_table_privilege('authenticated', 'public.messages', 'select')
  and not has_table_privilege('authenticated', 'public.messages', 'insert')
  and not has_table_privilege('authenticated', 'public.messages', 'update')
  and has_any_column_privilege('authenticated', 'public.messages', 'insert')
  and has_any_column_privilege('authenticated', 'public.messages', 'update')
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

-- ── Cross-workspace referential integrity ────────────────────────────────────
--
-- Every table below carries workspace_id next to a foreign key to a parent that
-- carries its own. RLS reads the child's workspace_id, so a child whose parent
-- lives elsewhere is served under the wrong workspace. The writers that can
-- produce one -- the provider webhooks and the send-* functions -- run as
-- service_role and bypass RLS entirely, so a policy cannot be the guard. These
-- statements run at the default role, with RLS out of the way, precisely so a
-- pass means the *constraint* refused the row.

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000902',
    'security-contract-neighbour@example.com',
    '{"full_name":"Neighbour workspace creator"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000907',
    'security-contract-teammate@example.com',
    '{"full_name":"Neighbour workspace teammate"}'::jsonb
  );

insert into public.workspaces (id, name, is_main, created_by)
values (
  '00000000-0000-4000-8000-000000000900',
  'Security contract neighbour workspace',
  false,
  '00000000-0000-4000-8000-000000000902'
);

-- on_workspace_created seated the creator as owner; the teammate is what makes
-- this a shared workspace rather than a personal one.
insert into public.workspace_members (workspace_id, user_id, role, invited_by)
values (
  '00000000-0000-4000-8000-000000000900',
  '00000000-0000-4000-8000-000000000907',
  'member',
  '00000000-0000-4000-8000-000000000902'
);

insert into public.channels (id, workspace_id, type, name)
values (
  '00000000-0000-4000-8000-000000000903',
  '00000000-0000-4000-8000-000000000900',
  'telegram',
  'Neighbour channel'
);

insert into public.contacts (id, workspace_id, name, source)
values (
  '00000000-0000-4000-8000-000000000904',
  '00000000-0000-4000-8000-000000000900',
  'Neighbour contact',
  'telegram'
);

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values (
  '00000000-0000-4000-8000-000000000905',
  '00000000-0000-4000-8000-000000000900',
  '00000000-0000-4000-8000-000000000904',
  '00000000-0000-4000-8000-000000000903'
);

insert into public.messages
  (id, workspace_id, conversation_id, direction, type, content)
values (
  '00000000-0000-4000-8000-000000000906',
  '00000000-0000-4000-8000-000000000900',
  '00000000-0000-4000-8000-000000000905',
  'inbound',
  'text',
  'Neighbour inbound message'
);

-- A message in the *first* workspace, so the reply-quote check below has a
-- parent on the far side of the boundary.
insert into public.messages
  (id, workspace_id, conversation_id, direction, type, content)
values (
  '00000000-0000-4000-8000-000000000908',
  (
    select w.id
    from public.workspaces w
    where w.name = 'Security contract workspace updated'
  ),
  '00000000-0000-4000-8000-000000000501',
  'inbound',
  'text',
  'Security contract inbound message'
);

select throws_ok(
  $$
    insert into public.messages
      (workspace_id, conversation_id, direction, type, content)
    values (
      '00000000-0000-4000-8000-000000000900',
      '00000000-0000-4000-8000-000000000501',
      'inbound',
      'text',
      'smuggled in from the neighbouring workspace'
    )
  $$,
  '23503',
  null,
  'a message cannot hang off a conversation in another workspace'
);

select throws_ok(
  $$
    insert into public.messages
      (workspace_id, conversation_id, direction, type, content,
       reply_to_message_id)
    values (
      '00000000-0000-4000-8000-000000000900',
      '00000000-0000-4000-8000-000000000905',
      'inbound',
      'text',
      'quoting across the boundary',
      '00000000-0000-4000-8000-000000000908'
    )
  $$,
  '23503',
  null,
  'a message cannot quote a message in another workspace'
);

select throws_ok(
  $$
    insert into public.message_attachments
      (workspace_id, message_id, position, kind)
    values (
      (
        select w.id
        from public.workspaces w
        where w.name = 'Security contract workspace updated'
      ),
      '00000000-0000-4000-8000-000000000906',
      0,
      'image'
    )
  $$,
  '23503',
  null,
  'an attachment cannot hang off a message in another workspace'
);

select throws_ok(
  $$
    insert into public.message_status_events
      (workspace_id, message_id, status)
    values (
      (
        select w.id
        from public.workspaces w
        where w.name = 'Security contract workspace updated'
      ),
      '00000000-0000-4000-8000-000000000906',
      'delivered'
    )
  $$,
  '23503',
  null,
  'a status event cannot hang off a message in another workspace'
);

select throws_ok(
  $$
    insert into public.message_reactions
      (workspace_id, channel_id, provider_message_id, reactor_external_id,
       emoji, action)
    values (
      (
        select w.id
        from public.workspaces w
        where w.name = 'Security contract workspace updated'
      ),
      '00000000-0000-4000-8000-000000000903',
      '9001',
      '555',
      '👍',
      'added'
    )
  $$,
  '23503',
  null,
  'a reaction cannot hang off a channel in another workspace'
);

select throws_ok(
  $$
    insert into public.message_notifications
      (workspace_id, conversation_id, message_id, recipient_id)
    values (
      (
        select w.id
        from public.workspaces w
        where w.name = 'Security contract workspace updated'
      ),
      '00000000-0000-4000-8000-000000000905',
      '00000000-0000-4000-8000-000000000906',
      '00000000-0000-4000-8000-000000000101'
    )
  $$,
  '23503',
  null,
  'a notification cannot hang off a message in another workspace'
);

select throws_ok(
  $$
    insert into public.provider_events
      (workspace_id, channel_id, provider, event_type, event_fingerprint,
       payload)
    values (
      (
        select w.id
        from public.workspaces w
        where w.name = 'Security contract workspace updated'
      ),
      '00000000-0000-4000-8000-000000000903',
      'telegram',
      'message',
      'fingerprint-cross-workspace',
      '{}'::jsonb
    )
  $$,
  '23503',
  null,
  'a provider event cannot hang off a channel in another workspace'
);

-- The constraints must not have become a blanket refusal: the same insert
-- inside one workspace still lands.
select lives_ok(
  $$
    insert into public.message_status_events
      (workspace_id, message_id, status)
    values (
      '00000000-0000-4000-8000-000000000900',
      '00000000-0000-4000-8000-000000000906',
      'delivered'
    )
  $$,
  'a child row whose workspace matches its parent is still accepted'
);

-- ── Deleting an account does not delete a shared workspace ───────────────────
--
-- workspaces.created_by cascaded from auth.users, so deleting one account
-- deleted every workspace it had created and, through the cascades below
-- workspaces, that team's channels, contacts, conversations and messages. The
-- optional actor columns were NO ACTION, which blocked the delete instead.

-- Align auth.uid() with the sender so ensure_message_sender_is_valid accepts the
-- outbound seed; reset role above left the earlier claims in place.
set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-000000000902","role":"authenticated"}';

insert into public.messages
  (id, workspace_id, conversation_id, direction, type, content, sender_id,
   status)
values (
  '00000000-0000-4000-8000-000000000909',
  '00000000-0000-4000-8000-000000000900',
  '00000000-0000-4000-8000-000000000905',
  'outbound',
  'text',
  'Sent before the account was deleted',
  '00000000-0000-4000-8000-000000000902',
  'sent'
);

update public.conversations
set assigned_to = '00000000-0000-4000-8000-000000000902'
where id = '00000000-0000-4000-8000-000000000905';

update public.workspaces
set updated_by = '00000000-0000-4000-8000-000000000902'
where id = '00000000-0000-4000-8000-000000000900';

select lives_ok(
  $$
    delete from auth.users
    where id = '00000000-0000-4000-8000-000000000902'
  $$,
  'an account that created a workspace and sent messages can be deleted'
);

select ok(
  exists (
    select 1
    from public.workspaces w
    where w.id = '00000000-0000-4000-8000-000000000900'
      and w.created_by is null
      and w.updated_by is null
  )
  and exists (
    select 1
    from public.conversations c
    where c.id = '00000000-0000-4000-8000-000000000905'
  ),
  'the shared workspace and its conversations survive the creator''s deletion'
);

select ok(
  exists (
    select 1
    from public.messages m
    where m.id = '00000000-0000-4000-8000-000000000909'
      and m.sender_id is null
  )
  and exists (
    select 1
    from public.conversations c
    where c.id = '00000000-0000-4000-8000-000000000905'
      and c.assigned_to is null
  ),
  'the sent message and the assignment survive with the actor cleared'
);

select ok(
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = '00000000-0000-4000-8000-000000000900'
      and wm.user_id = '00000000-0000-4000-8000-000000000907'
      and wm.invited_by is null
  )
  and not exists (
    select 1
    from public.workspace_members wm
    where wm.user_id = '00000000-0000-4000-8000-000000000902'
  ),
  'the remaining member keeps their seat and loses only the inviter reference'
);

select * from finish();

rollback;
