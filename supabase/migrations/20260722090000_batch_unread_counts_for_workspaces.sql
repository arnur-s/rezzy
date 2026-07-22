-- Batched per-agent unread counts across multiple workspaces, for the dashboard
-- surfaces (home stats, workspace cards, attention queue). These used to read
-- the shared conversations.unread_count column, which the per-agent migration
-- (20260721090300_per_agent_unread.sql) stopped clearing on read, leaving it
-- permanently inflated. This mirrors public.get_workspace_unread_counts but
-- accepts an array of workspace ids and returns only conversations that have
-- unread inbound messages for the caller, so the dashboard reflects the same
-- per-agent read cursor as the inbox.
--
-- SECURITY INVOKER + empty search_path: RLS restricts conversations/messages to
-- workspace members and conversation_reads to the caller's own rows.

create or replace function public.get_unread_counts_for_workspaces(
  p_workspace_ids uuid[]
)
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
  where c.workspace_id = any(p_workspace_ids)
  group by c.id
  having count(m.id) > 0;
$$;

comment on function public.get_unread_counts_for_workspaces(uuid[]) is
  'Returns per-conversation unread inbound message counts for the current user across the given workspaces, based on their read cursor. Only conversations with unread messages are returned.';

grant execute on function public.get_unread_counts_for_workspaces(uuid[]) to authenticated;
