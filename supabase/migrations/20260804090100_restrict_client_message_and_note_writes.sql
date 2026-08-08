begin;

-- authenticated held blanket INSERT/UPDATE on messages and contact_notes, so
-- the only thing standing between a workspace member and the CRM's history was
-- the RLS predicate. On messages that was not enough:
--
--   The UPDATE policy's USING clause matched every row in the workspace, and
--   its WITH CHECK accepted any row whose direction was 'inbound'. Flipping an
--   outbound message to inbound satisfied the check and simultaneously made
--   ensure_message_sender_is_valid a no-op, because that guard only inspects
--   outbound rows. From there a member could rewrite content, status, sender,
--   timestamps, provider identifiers and metadata on anybody's message.
--
--   INSERT was better fenced (outbound, sender must be self) but left
--   external_id, status, created_at, provider_timestamp and metadata to the
--   client, so a member could manufacture history that no provider ever
--   delivered.
--
-- The client's real write surface is narrow. src/features/inbox/api/messages.ts
-- inserts a send and updates nothing but status ('failed' when the Edge
-- Function rejects, 'sent' when retrying). Everything else that writes messages
-- -- the webhooks and the send-* functions -- runs as service_role, which holds
-- its own table-level grant and is untouched by the revokes below.
--
-- Column grants, not a trigger: the privilege layer refuses the statement
-- outright rather than relying on a guard that has to be kept in step with the
-- policy.

revoke insert, update on public.messages from authenticated;

grant insert (
  id,
  workspace_id,
  conversation_id,
  direction,
  type,
  content,
  media_url,
  media_mime_type,
  media_size,
  media_filename,
  sender_id,
  status,
  reply_to_message_id
) on public.messages to authenticated;

-- Withheld from the client on insert: external_id, external_reply_to_id,
-- provider_timestamp and metadata belong to the provider round trip;
-- created_at, edited_at and deleted_at are history the client must not author.

grant update (status) on public.messages to authenticated;

-- DELETE is left as it stands: the "Workspace admins can delete messages"
-- policy already restricts it to owner/admin, and no client code calls it.

drop policy if exists "Workspace members can update workspace messages"
on public.messages;

create policy "Workspace members can update outbound message status"
  on public.messages
  for update
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and direction = 'outbound'
  )
  with check (
    public.is_workspace_member(workspace_id)
    and direction = 'outbound'
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and c.workspace_id = messages.workspace_id
    )
  );

-- Inbound rows are now unreachable by an UPDATE from the browser, so the
-- direction flip has nothing to land on. The conversation/workspace agreement
-- check is redundant while conversation_id and workspace_id are ungranted, and
-- is kept so the policy still holds if a later migration widens the grant.

-- contact_notes: the collaborative surface is pinning and the author's own
-- body. Identity columns were only ever writable because the grant was
-- table-wide; enforce_contact_note_integrity raised on them, but a guard that
-- reads profiles is a weaker control than a privilege that does not exist.
--
-- INSERT keeps author_id and author_name granted on purpose: the insert policy
-- requires author_id = auth.uid() and the BEFORE trigger overwrites both from
-- the session, so a spoofed value is already neutralised twice over, and
-- contact_notes.test.sql asserts exactly that derivation.

revoke insert, update on public.contact_notes from authenticated;

grant insert (
  id,
  workspace_id,
  contact_id,
  author_id,
  author_name,
  body
) on public.contact_notes to authenticated;

grant update (body, is_pinned) on public.contact_notes to authenticated;

commit;
