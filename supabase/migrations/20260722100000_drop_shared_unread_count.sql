-- Remove the shared conversations.unread_count column entirely. Unread is now
-- per-agent, derived from each user's read cursor (public.conversation_reads)
-- via get_workspace_unread_counts / get_unread_counts_for_workspaces. The shared
-- counter only ever incremented (the per-agent migration stopped clearing it on
-- read), so it was a permanently-inflated second source of truth. This collapses
-- unread to a single source.
--
-- Steps, in dependency order:
--   1. Rewrite the inbound/outbound message triggers so they no longer touch the
--      column (they still maintain last_message_at, last_message_preview, and
--      outbound auto-assign). SECURITY DEFINER + empty search_path are preserved.
--   2. Drop the now-unused increment_unread() helper (nothing calls it).
--   3. Drop the column.

create or replace function public.handle_inbound_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'inbound' then
    update public.conversations
    set
      last_message_at = new.created_at,
      last_message_preview = coalesce(
        new.content,
        case new.type
          when 'image' then '📷 Photo'
          when 'video' then '🎥 Video'
          when 'audio' then '🎧 Audio'
          when 'voice' then '🎤 Voice message'
          when 'document' then coalesce(new.media_filename, '📎 Document')
          when 'sticker' then 'Sticker'
          else 'Message'
        end
      ),
      updated_at = now()
    where id = new.conversation_id;
  end if;

  return new;
end;
$$;

create or replace function public.handle_outbound_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'outbound' then
    update public.conversations
    set
      assigned_to = coalesce(assigned_to, new.sender_id),
      last_message_at = new.created_at,
      last_message_preview = coalesce(nullif(trim(new.content), ''), 'Message'),
      updated_at = now()
    where id = new.conversation_id
      and workspace_id = new.workspace_id;
  end if;

  return new;
end;
$$;

drop function if exists public.increment_unread(uuid);

alter table public.conversations drop column if exists unread_count;
