begin;

-- Claims and preflight failures share the message lock. Without it, a second
-- request can mark an in-flight message failed before discovering its fence.
-- A successful provider response cannot then advance that failed status.
create or replace function public.claim_outbound_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.messages where id = p_message_id for update;
  if not found then return false; end if;

  insert into private.outbound_message_dispatches (message_id)
  select m.id
  from public.messages m
  join public.conversations cv
    on cv.id = m.conversation_id and cv.workspace_id = m.workspace_id
  join public.channels ch
    on ch.id = cv.channel_id and ch.workspace_id = m.workspace_id
  join public.workspaces w on w.id = m.workspace_id
  where m.id = p_message_id
    and m.direction = 'outbound'
    and m.external_id is null
    and m.status = 'sent'
    and m.deleted_at is null
    and cv.deleted_at is null
    and ch.is_active
    and w.deleted_at is null
  on conflict (message_id) do nothing;
  return found;
end;
$$;

create or replace function public.release_outbound_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Keep the same lock order as claim: message first, fence second.
  perform 1 from public.messages where id = p_message_id for update;
  with released as (
    delete from private.outbound_message_dispatches d
    using public.messages m
    where d.message_id = p_message_id and m.id = d.message_id
      and m.direction = 'outbound' and m.external_id is null
    returning d.message_id
  )
  update public.messages m set status = 'failed'
  where m.id in (select message_id from released) and m.external_id is null;
end;
$$;

create function public.record_outbound_preflight_failure(
  p_message_id uuid,
  p_error_code text,
  p_error_type text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  select m.workspace_id into v_workspace_id
  from public.messages m
  where m.id = p_message_id and m.direction = 'outbound'
    and m.external_id is null and m.status = 'sent'
  for update;
  if not found then return false; end if;

  if exists (select 1 from private.outbound_message_dispatches where message_id = p_message_id) then
    return false;
  end if;

  -- Projection and history must be atomic too: a separate history insert could
  -- land after an explicit retry has already acquired its own dispatch fence.
  insert into public.message_status_events
    (workspace_id, message_id, status, error_code, error_type)
  values (v_workspace_id, p_message_id, 'failed', p_error_code, p_error_type);
  return true;
end;
$$;

revoke all on function public.claim_outbound_message(uuid) from public, anon, authenticated;
revoke all on function public.release_outbound_message(uuid) from public, anon, authenticated;
revoke all on function public.record_outbound_preflight_failure(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_outbound_message(uuid) to service_role;
grant execute on function public.release_outbound_message(uuid) to service_role;
grant execute on function public.record_outbound_preflight_failure(uuid, text, text) to service_role;

comment on function public.record_outbound_preflight_failure(uuid, text, text) is
  'Service-only atomic failure history/projection before dispatch. Refuses sent-to-provider or fenced messages; shares the parent row lock with claim/release so a second request cannot poison in-flight delivery.';

commit;
