-- Make database access explicit and keep privileged trigger helpers out of the
-- Data API surface. RLS remains the row-level authorization boundary.

-- These helpers can safely run as the caller: their table operations are
-- already covered by workspace-scoped RLS policies.
alter function public.is_workspace_member(uuid) security invoker;
alter function public.is_workspace_member(uuid) set search_path = '';

alter function public.mark_conversation_read(uuid, uuid) security invoker;
alter function public.mark_conversation_read(uuid, uuid) set search_path = '';

-- Workspace deletion is not an exposed product workflow yet. Keep the
-- owner-checking implementation internal until that workflow is designed.
alter function public.soft_delete_workspace(uuid) security definer;
alter function public.soft_delete_workspace(uuid) set search_path = '';

-- This legacy hosted-only RPC is unused and absent from the reproducible
-- migration chain. Remove it so local and linked schemas converge.
drop function if exists public.search_conversation_ids(uuid, text);

-- Trigger/event helpers keep their required definer rights, but use an empty
-- search path and cannot be called directly through PostgREST.
alter function public.auto_assign_conversation_on_outbound_message()
  set search_path = '';
alter function public.handle_inbound_message_insert() set search_path = '';
alter function public.handle_new_workspace() set search_path = '';
alter function public.handle_outbound_message_insert() set search_path = '';
alter function public.handle_updated_at() set search_path = '';
alter function public.sync_contact_last_seen() set search_path = '';

-- Service-only credential RPCs reference fully-qualified relations, so they do
-- not need writable schemas in their lookup path.
alter function public.get_channel_credentials(uuid) set search_path = '';
alter function public.get_whatsapp_channel_by_phone(text) set search_path = '';
alter function public.upsert_channel_credentials(uuid, jsonb)
  set search_path = '';

revoke all on function
  public.auto_assign_conversation_on_outbound_message(),
  public.ensure_conversation_assignee_is_workspace_member(),
  public.ensure_message_sender_is_valid(),
  public.handle_inbound_message_insert(),
  public.handle_new_workspace(),
  public.handle_outbound_message_insert(),
  public.handle_updated_at(),
  public.prevent_messages_for_inactive_channels(),
  public.rls_auto_enable(),
  public.sync_contact_last_seen()
from public, anon, authenticated;

-- Start from no browser-callable functions, then allow only intentional RPCs.
revoke execute on all functions in schema public
from public, anon, authenticated, service_role;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid, uuid)
  to authenticated;

-- Edge Functions use service-role clients for credential access.
grant execute on function public.get_channel_credentials(uuid) to service_role;
grant execute on function public.get_whatsapp_channel_by_phone(text)
  to service_role;
grant execute on function public.upsert_channel_credentials(uuid, jsonb)
  to service_role;

-- Remove broad legacy table grants and document the exact Data API contract.
revoke all privileges on table
  public.channels,
  public.contact_channels,
  public.contacts,
  public.conversation_reads,
  public.conversations,
  public.messages,
  public.profiles,
  public.workspace_members,
  public.workspaces
from anon, authenticated, service_role;

grant select, insert, update on table public.channels to authenticated;
grant select, insert, update, delete on table public.contact_channels
  to authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update on table public.conversation_reads
  to authenticated;
grant select, insert, update, delete on table public.conversations
  to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert on table public.workspace_members to authenticated;
grant select on table public.workspaces to authenticated;
grant insert (name, description, icon, is_main, created_by)
  on table public.workspaces to authenticated;
grant update (name, description, icon) on table public.workspaces
  to authenticated;

-- Older hosted schema snapshots contained direct-delete policies that are no
-- longer part of the supported product workflow.
drop policy if exists "Workspace members can delete own read cursors"
  on public.conversation_reads;
drop policy if exists "Workspace owners can delete workspaces"
  on public.workspaces;

grant select, insert, update, delete on table
  public.channels,
  public.contact_channels,
  public.contacts,
  public.conversation_reads,
  public.conversations,
  public.messages,
  public.profiles,
  public.workspace_members,
  public.workspaces
to service_role;

-- Future migrations must opt tables/functions into the Data API deliberately.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
