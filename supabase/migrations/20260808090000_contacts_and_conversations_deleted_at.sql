begin;

-- Contacts and conversations both carried an admin-only DELETE policy, and both
-- inbound foreign keys are NO ACTION:
--
--   conversations.contact_id                  -> contacts(id)
--   messages (workspace_id, conversation_id)  -> conversations (workspace_id, id)
--
-- So the delete succeeded only on a record with no history and raised 23503 on
-- exactly the records people want gone. Cascading is not the fix -- message
-- history is the product, and a delete that removes what a customer said and
-- what the team answered destroys the thing the inbox exists to hold.
--
-- The foreign keys stay restrictive. "Delete" stops meaning destroy.
--
-- ── Archive, not erasure ─────────────────────────────────────────────────────
--
-- Nothing here scrubs anything. An archived contact keeps name, phone, email,
-- avatar_url, notes, its contact_phones rows, its contact_channels external
-- identity and every message verbatim. This hides rows; it does not alter them.
-- An erasure request therefore has no product answer yet -- that would be a
-- second operation, and it is easier to add on top of deleted_at than to
-- retrofit.
--
-- That is also what makes the unarchive-on-inbound trigger in 20260808090200
-- coherent: because contact_channels.external_id is never scrubbed, the webhook
-- still resolves a returning customer to their existing contact.

alter table public.contacts
  add column if not exists deleted_at timestamptz;

alter table public.conversations
  add column if not exists deleted_at timestamptz;

comment on column public.contacts.deleted_at is
  'Set when the contact is archived. Archived contacts are invisible to every SELECT policy -- admins included -- and are reachable only through public.list_archived_contacts. Cleared by public.restore_contact, or automatically when the contact sends a new inbound message.';

comment on column public.conversations.deleted_at is
  'Set by the cascade from public.contacts.deleted_at. Conversations are never archived independently: status = ''closed'' already means "done with this thread", so a contact and its conversations always share one archived state.';

-- Only the two hot paths get a partial index. Archived rows are a small tail and
-- do not justify a live variant of every index on either table.
create index if not exists idx_conversations_workspace_last_message_live
  on public.conversations (workspace_id, last_message_at desc)
  where deleted_at is null;

create index if not exists idx_contacts_workspace_live
  on public.contacts (workspace_id)
  where deleted_at is null;


-- ── Visibility: the policy is the only filter ────────────────────────────────
--
-- deleted_at is null goes into the SELECT policies for EVERYONE, admins
-- included. There is no "admins can still see archived rows" branch, because a
-- policy that lets some callers through means every admin-reachable query has
-- to remember to exclude archived rows by hand. The archive view gets one
-- explicit, guarded RPC instead (20260808090100).
--
-- Putting it here rather than in each query is what makes the invariant hold for
-- readers that were never touched by this change:
--
--   search_workspace_contacts, match_workspace_contacts   SECURITY INVOKER
--   get_workspace_unread_counts                           SECURITY INVOKER
--   getWorkspaceConversations / …BySearch / …ById         PostgREST
--   getAttentionQueue, getHomeStats                       PostgREST
--
-- and for every reader added after it.

alter policy "Workspace members can view contacts"
on public.contacts
using (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
);

alter policy "Workspace members can view conversations"
on public.conversations
using (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
);

-- The same predicate in USING keeps an archived record from being edited while
-- hidden. Repeating it in WITH CHECK is the load-bearing half: it means a member
-- cannot archive a contact with a direct PostgREST update, because the new row
-- would carry a non-null deleted_at and fail the check. Archiving is therefore
-- reachable only through the admin-guarded RPC.
--
-- The cascade trigger below and the archive RPCs hold definer rights, so neither
-- is subject to this policy.

alter policy "Workspace members can update contacts"
on public.contacts
using (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
)
with check (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
);

alter policy "Workspace members can update conversations"
on public.conversations
using (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
)
with check (
  deleted_at is null
  and public.is_workspace_member(workspace_id)
);


-- ── Hard deletion becomes unreachable ────────────────────────────────────────
--
-- Both halves are needed: dropping the policy alone leaves the table grant in
-- place, and revoking the grant alone leaves a policy that reads as though
-- deletion were still supported.
--
-- public.messages keeps its admin DELETE policy. Making message history strictly
-- append-only is a larger decision than this change, and blocking future
-- moderation tooling is not something to do as a side effect.

drop policy if exists "Workspace admins can delete contacts" on public.contacts;
drop policy if exists "Workspace admins can delete conversations" on public.conversations;

revoke delete on table public.contacts from authenticated;
revoke delete on table public.conversations from authenticated;


-- ── The cascade ──────────────────────────────────────────────────────────────
--
-- This is a trigger rather than a second statement inside archive_contact() so
-- that ANY writer of contacts.deleted_at -- that RPC, a future one, a
-- service-role write, a manual fix -- cannot leave visible threads hanging off
-- an invisible contact.
--
-- Definer rights are required, not decorative. A trigger function otherwise runs
-- as the invoking user, and the restore direction updates conversations whose
-- deleted_at is NOT null -- rows the tightened UPDATE policy above forbids that
-- user from touching. An invoker-rights trigger would archive correctly and then
-- silently fail to restore. Both reads are pinned to the row the trigger was
-- handed and the search path is empty, so definer rights widen nothing.

create or replace function public.cascade_contact_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- workspace_id is included so the update rides the composite key rather than
  -- the contact_id index alone, and so a mis-scoped contact row cannot reach
  -- across workspaces.
  update public.conversations c
  set
    deleted_at = new.deleted_at,
    updated_at = now()
  where c.contact_id = new.id
    and c.workspace_id = new.workspace_id
    and c.deleted_at is distinct from new.deleted_at;

  return new;
end;
$$;

comment on function public.cascade_contact_archive() is
  'Propagates public.contacts.deleted_at to that contact''s conversations in the same transaction, in both directions. SECURITY DEFINER because the restore direction writes rows the conversations UPDATE policy hides from the caller.';

drop trigger if exists trg_cascade_contact_archive on public.contacts;
create trigger trg_cascade_contact_archive
  after update of deleted_at on public.contacts
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function public.cascade_contact_archive();

commit;
