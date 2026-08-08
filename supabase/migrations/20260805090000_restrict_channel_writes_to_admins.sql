begin;

-- Channels are workspace infrastructure, not a per-member document, but every
-- member could create and rewrite them: authenticated held table-wide
-- INSERT/UPDATE and both policies checked nothing beyond membership.
--
-- The reachable damage was not subtle. `is_active` is read by
-- prevent_messages_for_inactive_channels and by every send-* Edge Function, so
-- one member flipping it to false stops delivery for the whole workspace with
-- no audit trail and no UI that admits what happened. `provider_account_id` is
-- the routing key inbound webhooks resolve (entry.id -> channel), and it is
-- globally unique per type: rewriting it silently detaches a workspace's
-- inbound traffic, and squatting on a competitor's value blocks them from
-- connecting that account at all. The webhook health fields
-- (last_webhook_at, last_outbound_at, last_error_at, last_error_code,
-- api_version) are the only evidence the connection is failing, and a member
-- could clear them.
--
-- Two layers, because they refuse different things:
--
--   * Role, in the policy: creating or reconfiguring a channel is an
--     owner/admin act, matching the shape the delete policies on contacts and
--     contact_channels already use. SELECT stays open to every member -- the
--     inbox reads channels on every conversation render.
--
--   * Ownership, in the grants: the provider-owned columns are not writable by
--     authenticated at any role. They are written by the connect functions and
--     the webhooks, which use service-role clients (`admin` in
--     supabase/functions/*/index.ts) and hold their own table-wide grant from
--     20260720090850. Column grants to `authenticated` do not narrow it.
--
-- The client's real write surface on this table is two columns:
-- updateChannelName writes `name`, deactivateChannel/activateChannel write
-- `is_active` (src/features/channels/api/channels.ts). Nothing in the browser
-- inserts a channel -- the Telegram/WhatsApp/Instagram connect flows all go
-- through Edge Functions, and the Instagram OAuth start goes through
-- begin_instagram_oauth, which only reads channels. So no client path loses a
-- column it was using; a plain member loses the two writes it should never
-- have had.

drop policy if exists "Workspace members can create channels" on public.channels;

create policy "Workspace admins can create channels"
  on public.channels
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = channels.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = any (array['owner'::text, 'admin'::text])
    )
  );

drop policy if exists "Workspace members can update channels" on public.channels;

create policy "Workspace admins can update channels"
  on public.channels
  for update
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = channels.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = any (array['owner'::text, 'admin'::text])
    )
  )
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = channels.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = any (array['owner'::text, 'admin'::text])
    )
  );

-- "Workspace members can view channels" is left alone on purpose.

revoke insert, update on public.channels from authenticated;

grant insert (workspace_id, type, name, is_active)
  on public.channels to authenticated;

grant update (name, is_active) on public.channels to authenticated;

-- Withheld from the client entirely: provider_account_id and api_version
-- (identity of the connected account, owned by the OAuth/connect round trip),
-- last_webhook_at, last_outbound_at, last_error_at and last_error_code
-- (delivery health, owned by the webhook and send paths), plus id, created_at
-- and updated_at.

commit;
