-- WhatsApp channels are routed from a single shared webhook endpoint keyed by
-- the inbound payload's phone_number_id. The credentials store is the only place
-- that phone_number_id lives, so we add a service-role reverse lookup plus an
-- expression index to keep the high-frequency inbound path off a sequential scan.

create index if not exists idx_channel_secrets_wa_phone
  on private.channel_secrets ((credentials->>'phone_number_id'));

create or replace function public.get_whatsapp_channel_by_phone(
  p_phone_number_id text
)
returns table(channel_id uuid, workspace_id uuid, is_active boolean)
language sql
security definer
set search_path = public, private
as $$
  select c.id, c.workspace_id, c.is_active
  from private.channel_secrets s
  join public.channels c on c.id = s.channel_id
  where c.type = 'whatsapp'
    and s.credentials->>'phone_number_id' = p_phone_number_id
  limit 1
$$;

revoke all on function public.get_whatsapp_channel_by_phone(text) from public;
revoke all on function public.get_whatsapp_channel_by_phone(text) from anon;
revoke all on function public.get_whatsapp_channel_by_phone(text) from authenticated;
grant execute on function public.get_whatsapp_channel_by_phone(text) to service_role;
