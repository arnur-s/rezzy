-- Make unread state per-agent. Previously mark_conversation_read cleared the
-- shared conversations.unread_count, so one agent reading a thread wrongly
-- cleared unread for every agent. Unread is now derived from each user's read
-- cursor (public.conversation_reads), and marking a conversation read also marks
-- that user's notification records for the conversation as read.
--
-- Preserves the current security profile: SECURITY INVOKER + empty search_path
-- (RLS is the row-level authorization boundary).

create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_last_read_message_id uuid default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select c.workspace_id
    into target_workspace_id
  from public.conversations c
  where c.id = p_conversation_id;

  if target_workspace_id is null then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  if not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_last_read_message_id is not null
    and not exists (
      select 1
      from public.messages m
      where m.id = p_last_read_message_id
        and m.conversation_id = p_conversation_id
        and m.workspace_id = target_workspace_id
    )
  then
    raise exception 'Read cursor message does not belong to conversation'
      using errcode = '23503';
  end if;

  insert into public.conversation_reads (
    workspace_id,
    conversation_id,
    user_id,
    last_read_message_id,
    last_read_at
  )
  values (
    target_workspace_id,
    p_conversation_id,
    current_user_id,
    p_last_read_message_id,
    now()
  )
  on conflict (conversation_id, user_id)
  do update
    set
      workspace_id = excluded.workspace_id,
      last_read_message_id = excluded.last_read_message_id,
      last_read_at = now();

  -- Mark this user's notifications for the conversation read (per-agent). The
  -- shared conversations.unread_count is intentionally left untouched.
  update public.message_notifications
  set read_at = now()
  where recipient_id = current_user_id
    and conversation_id = p_conversation_id
    and read_at is null;
end;
$$;

comment on function public.mark_conversation_read(uuid, uuid) is
  'Stores the current user read cursor and marks their notifications for the conversation as read. Unread is per-agent; the shared counter is no longer cleared.';

grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;

-- Per-agent unread counts for a workspace, derived from the caller's read
-- cursor. SECURITY INVOKER: RLS restricts conversations/messages to workspace
-- members and conversation_reads to the caller's own rows.
create or replace function public.get_workspace_unread_counts(p_workspace_id uuid)
returns table (conversation_id uuid, unread_count integer)
language sql
stable
set search_path = ''
as $$
  select
    c.id as conversation_id,
    count(m.id)::int as unread_count
  from public.conversations c
  left join public.conversation_reads cr
    on cr.conversation_id = c.id
   and cr.user_id = auth.uid()
  left join public.messages m
    on m.conversation_id = c.id
   and m.direction = 'inbound'
   and (cr.last_read_at is null or m.created_at > cr.last_read_at)
  where c.workspace_id = p_workspace_id
  group by c.id;
$$;

comment on function public.get_workspace_unread_counts(uuid) is
  'Returns per-conversation unread inbound message counts for the current user in a workspace, based on their read cursor.';

grant execute on function public.get_workspace_unread_counts(uuid) to authenticated;
