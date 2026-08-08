begin;

-- Optional actor references to auth.users were left at NO ACTION, so an account
-- could not be deleted while anything it had touched still existed: a
-- conversation it was assigned, a message it sent, an invitation it issued, a
-- workspace it last edited. None of those columns carry meaning once the account
-- is gone, and all four are already nullable (verified before writing this), so
-- SET NULL is the action that matches the data model: the row survives, the
-- attribution expires.
--
-- Deliberately not in this list: workspace_members.user_id, profiles.id,
-- conversation_reads.user_id, message_notifications.recipient_id,
-- push_subscriptions.user_id and notification_preferences.user_id. Those are all
-- NOT NULL and already CASCADE, which is correct -- they are the user's own
-- rows, not a mark the user left on somebody else's.

alter table public.conversations
  drop constraint conversations_assigned_to_fkey;

alter table public.conversations
  add constraint conversations_assigned_to_fkey
  foreign key (assigned_to) references auth.users (id)
  on delete set null;

alter table public.messages
  drop constraint messages_sender_id_fkey;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references auth.users (id)
  on delete set null;

alter table public.workspace_members
  drop constraint workspace_members_invited_by_fkey;

alter table public.workspace_members
  add constraint workspace_members_invited_by_fkey
  foreign key (invited_by) references auth.users (id)
  on delete set null;

alter table public.workspaces
  drop constraint workspaces_updated_by_fkey;

alter table public.workspaces
  add constraint workspaces_updated_by_fkey
  foreign key (updated_by) references auth.users (id)
  on delete set null;

-- ensure_message_sender_is_valid would have made messages_sender_id_fkey
-- unusable in practice. A referential SET NULL is an ordinary UPDATE, so it
-- fires this BEFORE UPDATE guard, and the guard rejects an outbound row with a
-- null sender. Deleting a user who had ever sent a message would therefore fail
-- with OUTBOUND_SENDER_REQUIRED -- exactly the block this migration removes,
-- moved one layer down.
--
-- The fix lets through precisely one transition: a sender that was set becoming
-- null. Nothing else can perform it. authenticated holds UPDATE on
-- messages.status alone (20260804090100), so the browser cannot reach sender_id
-- at all, and service_role could already write anything. Every insert, and
-- every update that names a sender, is checked exactly as before.
create or replace function public.ensure_message_sender_is_valid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.sender_id is not null
    and new.sender_id is null
  then
    return new;
  end if;

  if new.direction = 'outbound' then
    if new.sender_id is null then
      raise exception 'OUTBOUND_SENDER_REQUIRED'
        using errcode = '23502';
    end if;

    -- auth.uid() is null for the service-role webhook and send paths, which
    -- legitimately write outbound rows on behalf of the original sender.
    if (select auth.uid()) is not null and new.sender_id <> (select auth.uid()) then
      raise exception 'OUTBOUND_SENDER_MUST_BE_CURRENT_USER'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.sender_id
    ) then
      raise exception 'SENDER_NOT_WORKSPACE_MEMBER'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

-- ensure_conversation_assignee_is_workspace_member needs no equivalent change:
-- it already returns early when new.assigned_to is null.
--
-- Both conversations and workspaces carry a BEFORE UPDATE handle_updated_at
-- trigger, so unassigning through this path also bumps updated_at. That only
-- happens when an account is deleted, and neither table orders on updated_at
-- (the inbox orders on last_message_at), so nothing user-visible moves.

commit;
