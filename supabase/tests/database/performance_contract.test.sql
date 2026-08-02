begin;

select plan(2);

-- Every targeted policy must retain an auth.uid() check, and every occurrence
-- must be inside a scalar SELECT so Postgres can use an initPlan.
with expected_policies(schema_name, table_name, policy_name) as (
  values
    (
      'public',
      'contact_channels',
      'Workspace admins can delete contact channels'
    ),
    (
      'public',
      'contact_notes',
      'Workspace members can create contact notes'
    ),
    (
      'public',
      'contact_notes',
      'Authors and workspace admins can delete contact notes'
    ),
    ('public', 'contacts', 'Workspace admins can delete contacts'),
    ('public', 'conversations', 'Workspace admins can delete conversations'),
    ('public', 'messages', 'Workspace admins can delete messages'),
    (
      'public',
      'messages',
      'Workspace members can create outbound messages as themselves'
    ),
    (
      'public',
      'messages',
      'Workspace members can update workspace messages'
    ),
    ('public', 'profiles', 'Users can insert own profile'),
    ('public', 'profiles', 'Users can update own profile'),
    ('public', 'profiles', 'Users can view own profile'),
    (
      'public',
      'workspace_members',
      'Users can view own workspace memberships'
    ),
    (
      'public',
      'workspace_members',
      'Workspace creators can create owner membership'
    ),
    ('public', 'workspaces', 'Users can create workspaces'),
    (
      'public',
      'workspaces',
      'Workspace admins can update active workspaces'
    ),
    ('storage', 'objects', 'Workspace members can delete chat media'),
    ('storage', 'objects', 'Workspace members can read chat media objects'),
    ('storage', 'objects', 'Workspace members can update chat media'),
    ('storage', 'objects', 'Workspace members can upload chat media')
), policy_expressions as (
  select
    expected.schema_name,
    expected.table_name,
    expected.policy_name,
    lower(concat_ws(' ', policy.qual, policy.with_check)) as expression
  from expected_policies expected
  left join pg_policies policy
    on policy.schemaname = expected.schema_name
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
)
select ok(
  not exists (
    select 1
    from policy_expressions
    where expression is null
       or position('select auth.uid()' in expression) = 0
       or position(
         'auth.uid()' in replace(expression, 'select auth.uid()', '')
       ) > 0
  ),
  'targeted RLS policies cache every auth.uid() call'
);

-- Assert that each reported foreign key has the intended full btree index
-- with its FK column as the leading key. Partial/composite indexes that start
-- with a different column do not satisfy this contract.
with expected_indexes(table_name, index_name, column_name) as (
  values
    (
      'contact_channels',
      'contact_channels_contact_id_fkey_idx',
      'contact_id'
    ),
    (
      'contact_notes',
      'contact_notes_author_id_idx',
      'author_id'
    ),
    (
      'contacts',
      'contacts_owner_id_fkey_idx',
      'owner_id'
    ),
    (
      'contact_notes',
      'contact_notes_contact_order_idx',
      'workspace_id'
    ),
    (
      'conversation_reads',
      'conversation_reads_user_id_fkey_idx',
      'user_id'
    ),
    (
      'conversations',
      'conversations_assigned_to_fkey_idx',
      'assigned_to'
    ),
    (
      'conversations',
      'conversations_channel_id_fkey_idx',
      'channel_id'
    ),
    ('messages', 'messages_sender_id_fkey_idx', 'sender_id'),
    (
      'workspace_members',
      'workspace_members_invited_by_fkey_idx',
      'invited_by'
    ),
    ('workspaces', 'workspaces_updated_by_fkey_idx', 'updated_by')
)
select ok(
  not exists (
    select 1
    from expected_indexes expected
    left join pg_namespace table_namespace
      on table_namespace.nspname = 'public'
    left join pg_class table_class
      on table_class.relnamespace = table_namespace.oid
     and table_class.relname = expected.table_name
     and table_class.relkind in ('r', 'p')
    left join pg_class index_class
      on index_class.relnamespace = table_namespace.oid
     and index_class.relname = expected.index_name
     and index_class.relkind = 'i'
    left join pg_index index_metadata
      on index_metadata.indexrelid = index_class.oid
     and index_metadata.indrelid = table_class.oid
    left join pg_am access_method
      on access_method.oid = index_class.relam
    left join pg_attribute indexed_column
      on indexed_column.attrelid = table_class.oid
     and indexed_column.attname = expected.column_name
    where index_metadata.indexrelid is null
       or not index_metadata.indisvalid
       or not index_metadata.indisready
       or index_metadata.indpred is not null
       or index_metadata.indexprs is not null
       or access_method.amname <> 'btree'
       or indexed_column.attnum is null
       or index_metadata.indkey[0] <> indexed_column.attnum
  ),
  'advisor-reported foreign keys have full leading-column btree indexes'
);

select * from finish();

rollback;
