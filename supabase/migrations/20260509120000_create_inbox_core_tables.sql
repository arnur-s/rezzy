-- Core inbox schema that existing workspace-scoped RLS migrations depend on.
-- This records objects that already exist in the remote database so the local
-- migration chain can replay cleanly in Supabase shadow databases.

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  type text not null,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channels_type_check
    check (type in ('whatsapp', 'instagram', 'telegram', 'email'))
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  name text,
  phone text,
  email text,
  avatar_url text,
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tags text[] not null default '{}',
  last_seen_at timestamptz,
  source text,
  constraint contacts_status_check
    check (status in ('new', 'in_progress', 'done', 'lost')),
  constraint contacts_source_check
    check (source is null or source in ('whatsapp', 'instagram', 'telegram', 'email', 'manual'))
);

create table if not exists public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id),
  channel_type text not null,
  external_id text not null,
  external_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint contact_channels_channel_type_check
    check (channel_type in ('whatsapp', 'instagram', 'telegram', 'email'))
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  contact_id uuid not null references public.contacts(id),
  channel_id uuid not null references public.channels(id),
  assigned_to uuid references auth.users(id),
  status text not null default 'open',
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  snoozed_until timestamptz,
  constraint conversations_status_check
    check (status in ('open', 'closed', 'snoozed')),
  constraint conversations_contact_channel_unique unique (contact_id, channel_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  conversation_id uuid not null references public.conversations(id),
  external_id text,
  direction text not null,
  type text not null default 'text',
  content text,
  media_url text,
  media_mime_type text,
  media_size integer,
  media_filename text,
  sender_id uuid references auth.users(id),
  status text default 'sent',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint messages_direction_check
    check (direction in ('inbound', 'outbound')),
  constraint messages_type_check
    check (type in ('text', 'image', 'video', 'audio', 'voice', 'document', 'sticker')),
  constraint messages_status_check
    check (status in ('sent', 'delivered', 'read', 'failed'))
);

create table if not exists private.channel_secrets (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  credentials jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_channels_workspace
  on public.channels(workspace_id, is_active);

create index if not exists idx_contacts_workspace
  on public.contacts(workspace_id);

create index if not exists idx_contacts_workspace_status
  on public.contacts(workspace_id, status);

create index if not exists idx_contacts_workspace_source
  on public.contacts(workspace_id, source);

create index if not exists idx_contacts_last_seen
  on public.contacts(workspace_id, last_seen_at desc nulls last);

create index if not exists idx_contacts_tags
  on public.contacts using gin(tags);

create unique index if not exists uq_contact_channels_type_external
  on public.contact_channels(workspace_id, channel_type, external_id);

create index if not exists idx_contact_channels_lookup
  on public.contact_channels(channel_type, external_id);

create index if not exists idx_contact_channels_workspace_id
  on public.contact_channels(workspace_id);

create index if not exists idx_conversations_workspace_last_message
  on public.conversations(workspace_id, last_message_at desc);

create index if not exists idx_conversations_status
  on public.conversations(workspace_id, status);

create index if not exists idx_conversations_assigned_to
  on public.conversations(workspace_id, assigned_to);

create index if not exists idx_conversations_channel
  on public.conversations(workspace_id, channel_id, last_message_at desc);

create index if not exists idx_conversations_contact
  on public.conversations(contact_id);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at);

create index if not exists idx_messages_external_id
  on public.messages(external_id);

create unique index if not exists messages_unique_external_id
  on public.messages(workspace_id, conversation_id, external_id)
  where external_id is not null;

drop trigger if exists channels_updated_at on public.channels;
create trigger channels_updated_at
before update on public.channels
for each row execute function public.handle_updated_at();

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at
before update on public.contacts
for each row execute function public.handle_updated_at();

drop trigger if exists conversations_updated_at on public.conversations;
create trigger conversations_updated_at
before update on public.conversations
for each row execute function public.handle_updated_at();

create or replace function public.get_channel_credentials(p_channel_id uuid)
returns jsonb
language sql
security definer
set search_path = public, private
as $$
  select credentials
  from private.channel_secrets
  where channel_id = p_channel_id
$$;

create or replace function public.upsert_channel_credentials(
  p_channel_id uuid,
  p_credentials jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into private.channel_secrets (channel_id, credentials)
  values (p_channel_id, p_credentials)
  on conflict (channel_id)
  do update set credentials = excluded.credentials;
end;
$$;

revoke all on function public.get_channel_credentials(uuid) from public;
revoke all on function public.get_channel_credentials(uuid) from anon;
revoke all on function public.get_channel_credentials(uuid) from authenticated;
grant execute on function public.get_channel_credentials(uuid) to service_role;

revoke all on function public.upsert_channel_credentials(uuid, jsonb) from public;
revoke all on function public.upsert_channel_credentials(uuid, jsonb) from anon;
revoke all on function public.upsert_channel_credentials(uuid, jsonb) from authenticated;
grant execute on function public.upsert_channel_credentials(uuid, jsonb) to service_role;
