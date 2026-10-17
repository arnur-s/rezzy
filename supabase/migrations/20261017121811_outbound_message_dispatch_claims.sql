begin;

-- A message row is created before the provider request, so external_id IS NULL
-- alone does not distinguish a new send from a second request already in flight.
-- Keep the claim outside the browser-writable status column: retrying a failed
-- request must not remove the fence while the provider outcome is still unknown.
create table private.outbound_message_dispatches (
  message_id uuid primary key references public.messages(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table private.outbound_message_dispatches enable row level security;
revoke all on table private.outbound_message_dispatches
  from public, anon, authenticated, service_role;

comment on table private.outbound_message_dispatches is
  'A permanent dispatch fence for a message whose provider send has started. Only a definitive rejection may release it. No expiry: after a timeout the provider may already have accepted the message, and a lease would permit a duplicate.';

create or replace function public.claim_outbound_message(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
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
    on conflict (message_id) do nothing
    returning message_id
  )
  select exists (select 1 from claimed);
$$;

create or replace function public.release_outbound_message(p_message_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with released as (
    delete from private.outbound_message_dispatches d
    using public.messages m
    where d.message_id = p_message_id
      and m.id = d.message_id
      and m.direction = 'outbound'
      and m.external_id is null
    returning d.message_id
  )
  update public.messages m
  set status = 'failed'
  where m.id in (select message_id from released)
    and m.external_id is null;
$$;

comment on function public.claim_outbound_message(uuid) is
  'Service-only atomic claim immediately before a provider send. False means the message is ineligible or another request already owns its dispatch; never send in that case.';
comment on function public.release_outbound_message(uuid) is
  'Service-only release after a definite provider rejection or before any provider request. Atomically marks the undelivered message failed for explicit retry. Never call after an ambiguous transport failure.';

revoke all on function public.claim_outbound_message(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.release_outbound_message(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_outbound_message(uuid) to service_role;
grant execute on function public.release_outbound_message(uuid) to service_role;

commit;
