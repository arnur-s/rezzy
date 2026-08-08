begin;

-- A returning customer un-hides themselves.
--
-- The alternative -- an archived thread that silently swallows inbound messages,
-- with no unread count and no notification -- is the exact failure the inbox
-- exists to prevent. Archive means "not on my plate right now", and a new
-- inbound message is the signal that it is again.
--
-- This works only because archiving scrubs nothing. contact_channels.external_id
-- still holds the customer's channel identity, so supabase/functions/_shared/
-- persist.ts resolves them to their existing contact and lands the message on
-- the archived conversation, where this trigger can see it. Under an anonymizing
-- design the message would open a brand-new contact instead and there would be
-- nothing to unarchive.
--
-- ── Why BEFORE, and why that is load-bearing ─────────────────────────────────
--
-- Postgres fires AFTER triggers in name order. The existing set on
-- public.messages is, in that order:
--
--   trg_apply_latest_message_status
--   trg_auto_assign_conversation_on_outbound_message
--   trg_create_message_notifications
--   trg_handle_inbound_message_insert
--   trg_handle_outbound_message_insert
--
-- An AFTER trigger named for what it does sorts after
-- trg_create_message_notifications, so the notification would be created against
-- a still-archived conversation: the recipient gets an alert that opens a thread
-- RLS hides from them. Winning that race would mean picking a name for its
-- leading characters rather than its meaning, and any trigger added later could
-- quietly take the slot back.
--
-- Every BEFORE trigger runs ahead of every AFTER trigger regardless of name. So
-- by the time public.create_message_notifications() and
-- public.get_workspace_unread_counts() run, nothing is archived -- which is why
-- neither needed a deleted_at guard of its own.
--
-- Definer rights are required: the rows this clears carry a non-null deleted_at,
-- which the conversations and contacts UPDATE policies (20260808090000) hide
-- from every caller. The service-role webhook path would bypass RLS anyway, but
-- the trigger must not depend on who happens to be inserting.

create or replace function public.unarchive_on_inbound_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_id uuid;
  v_conversation_archived boolean;
  v_contact_archived boolean;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  -- One primary-key probe on the hot path. Reading both states before writing
  -- anything keeps the overwhelmingly common case -- a live conversation -- to a
  -- single SELECT rather than two UPDATEs that match no rows.
  select
    cv.contact_id,
    cv.deleted_at is not null,
    c.deleted_at is not null
  into v_contact_id, v_conversation_archived, v_contact_archived
  from public.conversations cv
  join public.contacts c
    on c.id = cv.contact_id
   and c.workspace_id = cv.workspace_id
  where cv.id = new.conversation_id;

  if v_contact_id is null then
    -- No conversation, or no contact behind it. The foreign key on the insert
    -- about to happen is what reports that; this trigger stays out of it.
    return new;
  end if;

  if not v_conversation_archived and not v_contact_archived then
    return new;
  end if;

  -- Clearing the contact is enough in the normal case:
  -- trg_cascade_contact_archive carries the null down to every conversation of
  -- this contact, which is what keeps the two in one shared state.
  if v_contact_archived then
    update public.contacts
    set
      deleted_at = null,
      updated_at = now()
    where id = v_contact_id
      and deleted_at is not null;
  end if;

  -- Reached when a conversation is archived while its contact is not -- which
  -- the cascade never produces, but a direct write could. Guarded on deleted_at
  -- so it is a no-op when the cascade above already cleared it.
  if v_conversation_archived then
    update public.conversations
    set
      deleted_at = null,
      updated_at = now()
    where id = new.conversation_id
      and deleted_at is not null;
  end if;

  return new;
end;
$$;

comment on function public.unarchive_on_inbound_message() is
  'Clears deleted_at on an archived conversation and its contact when an inbound message arrives. BEFORE INSERT so it is guaranteed to run before trg_create_message_notifications, which would otherwise notify a recipient about a thread RLS still hides from them.';

drop trigger if exists trg_unarchive_on_inbound_message on public.messages;
create trigger trg_unarchive_on_inbound_message
  before insert on public.messages
  for each row
  execute function public.unarchive_on_inbound_message();

commit;
