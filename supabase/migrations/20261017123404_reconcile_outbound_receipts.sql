begin;

-- A callback can reach the webhook before the sender saves its provider id.
-- Its durable provider_events row is already committed at that point. After
-- saving external_id, senders replay matching receipts from that ledger. The
-- two post-commit lookups cover both orderings without a queue or retry loop.
-- Older retries could create duplicate history when provider_timestamp was
-- NULL. Keep the first receipt for each exact event/status identity; the raw
-- provider ledger and every distinct status remain intact. Hold a write lock
-- through index creation so a callback cannot insert another duplicate between
-- cleanup and enforcement.
lock table public.message_status_events in share row exclusive mode;
with repeated_receipts as (
  select id, row_number() over (
    partition by message_id, provider_event_id, status
    order by created_at, id
  ) as receipt_number
  from public.message_status_events
  where provider_event_id is not null
)
delete from public.message_status_events se
using repeated_receipts r
where se.id = r.id and r.receipt_number > 1;

create unique index message_status_events_provider_event_key
  on public.message_status_events (message_id, provider_event_id, status)
  where provider_event_id is not null;

-- These are the exact ledger lookups performed on each accepted Meta send.
create index provider_events_whatsapp_receipt_idx
  on public.provider_events (channel_id, (payload ->> 'id'))
  where provider = 'whatsapp' and event_type = 'status';
create index provider_events_instagram_receipt_idx
  on public.provider_events (channel_id, (payload #>> '{read,mid}'))
  where provider = 'instagram' and event_type = 'read';

create function public.reconcile_outbound_receipts(p_message_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  with target as (
    select m.id, m.workspace_id, m.external_id, cv.channel_id, ch.type as provider
    from public.messages m
    join public.conversations cv
      on cv.id = m.conversation_id and cv.workspace_id = m.workspace_id
    join public.channels ch
      on ch.id = cv.channel_id and ch.workspace_id = m.workspace_id
    where m.id = p_message_id
      and m.direction = 'outbound'
      and m.external_id is not null
  ), receipts as (
    select t.id as message_id, t.workspace_id, pe.id as event_id,
           pe.provider_timestamp, pe.created_at,
           case when pe.provider = 'instagram' then 'read'
                else pe.payload ->> 'status' end as status,
           pe.payload #>> '{errors,0,code}' as error_code,
           pe.payload #>> '{errors,0,title}' as error_type
    from target t
    join public.provider_events pe
      on pe.workspace_id = t.workspace_id
      and pe.channel_id = t.channel_id
      and pe.provider = t.provider
    where (pe.provider = 'whatsapp' and pe.event_type = 'status'
           and pe.payload ->> 'id' = t.external_id
           and pe.payload ->> 'status' in ('sent', 'delivered', 'read', 'played', 'failed'))
       or (pe.provider = 'instagram' and pe.event_type = 'read'
           and pe.payload #>> '{read,mid}' = t.external_id)
  ), inserted as (
    insert into public.message_status_events
      (workspace_id, message_id, provider_event_id, status,
       provider_timestamp, error_code, error_type)
    select workspace_id, message_id, event_id, status,
           provider_timestamp, error_code, error_type
    from receipts
    order by coalesce(provider_timestamp, created_at), event_id
    on conflict do nothing
    returning id
  )
  select count(*) from inserted;
$$;

revoke all on function public.reconcile_outbound_receipts(uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_outbound_receipts(uuid) to service_role;

comment on function public.reconcile_outbound_receipts(uuid) is
  'Service-only idempotent receipt replay after an outbound provider id is committed. Reads exact workspace/channel/provider identity; retains provider-event processing ownership and ignores malformed or unsupported receipts.';

commit;
