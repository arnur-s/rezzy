begin;

-- Removing somebody from a workspace left their name attached to work.
-- contacts.owner_id and conversations.assigned_to are plain references to
-- auth.users, guarded on write by ensure_contact_owner_is_workspace_member and
-- ensure_conversation_assignee_is_workspace_member -- but those are BEFORE
-- INSERT OR UPDATE triggers on the child rows, so nothing re-validates them
-- when the membership underneath disappears.
--
-- What that leaves behind:
--
--   * A contact owned by, and a conversation assigned to, a user who can no
--     longer open either. The assignee avatar renders from the roster, and the
--     roster (list_workspace_members) reads workspace_members, so the assignee
--     silently drops out of the picker while staying set on the row.
--   * create_message_notifications routes an inbound message to the assignee
--     alone when a conversation is assigned, and to the whole roster when it is
--     not. An assignment to a departed member is neither: the notification rows
--     are written for a recipient with no seat, and the members still in the
--     workspace are not told the customer replied. A stale assignment is the
--     one state that makes a thread go quiet.
--   * The guards would refuse to write the same value again, so the row is
--     stuck until somebody reassigns it by hand.
--
-- Clearing on removal returns both rows to their unassigned state, which the
-- product already handles everywhere: unowned contacts appear in the directory
-- with no owner filter applied, and unassigned conversations notify the whole
-- roster, which is what should happen to a thread whose agent has left.
--
-- Not reachable from the browser yet: authenticated holds no DELETE grant on
-- workspace_members and there is no removal UI. This ships the cleanup so the
-- removal path cannot land without it. It also covers the one removal that does
-- happen today -- workspace_members.user_id is ON DELETE CASCADE from
-- auth.users, so deleting an account now clears that account's assignments
-- through this trigger as well as through the ON DELETE SET NULL on the actor
-- columns themselves.
--
-- Definer rights for the same reason the assignee guards have them
-- (20260804090000): the statements below cross rows belonging to other users,
-- and the caller's RLS view of contacts and conversations is not the right
-- authority for a cleanup that the database owes the workspace.

create or replace function public.clear_assignments_for_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set assigned_to = null
  where workspace_id = old.workspace_id
    and assigned_to = old.user_id;

  update public.contacts
  set owner_id = null
  where workspace_id = old.workspace_id
    and owner_id = old.user_id;

  -- AFTER trigger: the return value is discarded.
  return null;
end;
$$;

-- handle_updated_at is a BEFORE UPDATE trigger on both tables, so updated_at
-- moves without being assigned here.

revoke all on function public.clear_assignments_for_removed_member()
from public, anon, authenticated, service_role;

drop trigger if exists trg_clear_assignments_for_removed_member
  on public.workspace_members;

create trigger trg_clear_assignments_for_removed_member
after delete on public.workspace_members
for each row
execute function public.clear_assignments_for_removed_member();

commit;
