-- Atomic claim helper for the provider-event pipeline. Concurrent Edge Function
-- instances race safely: the insert wins exactly once per fingerprint; failed
-- temporary events and stale 'processing' claims (crashed instances) can be
-- reclaimed by exactly one caller; everything else is a duplicate delivery.

create or replace function public.claim_provider_event(
  p_workspace_id uuid,
  p_channel_id uuid,
  p_provider text,
  p_event_type text,
  p_event_fingerprint text,
  p_payload jsonb,
  p_provider_timestamp timestamptz default null
)
returns table (event_id uuid, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.provider_events
    (workspace_id, channel_id, provider, event_type, event_fingerprint,
     payload, provider_timestamp, status, attempts, claimed_at)
  values
    (p_workspace_id, p_channel_id, p_provider, p_event_type, p_event_fingerprint,
     p_payload, p_provider_timestamp, 'processing', 1, now())
  on conflict (channel_id, event_fingerprint) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  update public.provider_events
  set status = 'processing',
      attempts = attempts + 1,
      claimed_at = now(),
      last_error = null,
      error_kind = null
  where channel_id = p_channel_id
    and event_fingerprint = p_event_fingerprint
    and ((status = 'failed' and error_kind = 'temporary')
         or (status = 'processing' and claimed_at < now() - interval '5 minutes')
         or status = 'pending')
  returning id into v_id;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  return query select null::uuid, true;
end;
$$;

revoke all on function public.claim_provider_event(uuid, uuid, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_provider_event(uuid, uuid, text, text, text, jsonb, timestamptz)
  to service_role;
