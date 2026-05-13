-- Atomic unread bump for inbound messages (used by telegram-webhook Edge Function).

create or replace function public.increment_unread(conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.conversations
  set unread_count = coalesce(unread_count, 0) + 1
  where id = conversation_id
  returning unread_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

comment on function public.increment_unread(uuid) is
  'Increments conversations.unread_count by 1 and returns the new value.';

revoke all on function public.increment_unread(uuid) from PUBLIC;
revoke all on function public.increment_unread(uuid) from anon;
revoke all on function public.increment_unread(uuid) from authenticated;

grant execute on function public.increment_unread(uuid) to service_role;
