-- Append-only per-message status history. messages.status stays the fast
-- "latest" value for UI rendering and is maintained by an advance-only trigger,
-- so stale or out-of-order provider callbacks can never regress it.
--
-- Status vocabulary is wider than messages.status: local send lifecycle
-- (queued/sending/accepted), provider receipts (sent/delivered/read/played),
-- failures, provider deletions, and unknown provider statuses are all recorded
-- here; only sent/delivered/read/played/failed are ever projected onto
-- messages.status.

create table public.message_status_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  status text not null
    constraint message_status_events_status_check
    check (status in (
      'queued', 'sending', 'accepted', 'sent', 'delivered',
      'read', 'played', 'failed', 'deleted', 'unknown'
    )),
  provider_event_id uuid references public.provider_events(id) on delete set null,
  provider_timestamp timestamptz,
  error_code text,
  error_subcode text,
  error_type text,
  trace_id text,
  retryable boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.message_status_events is
  'Append-only message delivery/status history. Latest UI-visible status is projected onto messages.status by trigger, advance-only.';
comment on column public.message_status_events.provider_event_id is 'provider_events row that produced this status event, when webhook-driven.';
comment on column public.message_status_events.provider_timestamp is 'Status timestamp reported by the provider.';
comment on column public.message_status_events.error_code is 'Safe provider error code (e.g. Meta error code). Never message bodies or tokens.';
comment on column public.message_status_events.error_subcode is 'Safe provider error subcode.';
comment on column public.message_status_events.error_type is 'Safe provider error type/class.';
comment on column public.message_status_events.trace_id is 'Safe provider trace/request id (e.g. fbtrace_id) for support escalation.';
comment on column public.message_status_events.retryable is 'Whether the provider indicated the failure is retryable.';
comment on column public.message_status_events.metadata is 'Sanitized structured status details (e.g. WhatsApp conversation/pricing objects).';

-- Webhook duplicates are already deduped at provider_events; this guards
-- direct writers (send functions, retries) against double-inserting the same
-- provider-timestamped status.
create unique index message_status_events_dedup_key
  on public.message_status_events (message_id, status, provider_timestamp)
  where provider_timestamp is not null;

create index message_status_events_message_idx
  on public.message_status_events (message_id, created_at);

create index message_status_events_workspace_idx
  on public.message_status_events (workspace_id, created_at);

alter table public.message_status_events enable row level security;

revoke all on public.message_status_events from anon, authenticated;
grant select on public.message_status_events to authenticated;
grant select, insert, update, delete on public.message_status_events to service_role;

create policy "Workspace members can view message status events"
  on public.message_status_events
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- Advance-only projection onto messages.status.
-- Ranks: sent 3 < delivered 4 < read 5 < played 6. 'failed' applies unless the
-- message already reached read/played/failed. queued/sending/accepted are
-- below 'sent' and never projected (messages.status starts at 'sent');
-- 'deleted' maps to messages.deleted_at (set by the pipeline), 'unknown' is
-- history-only.
create or replace function public.apply_latest_message_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rank_new integer;
begin
  if new.status = 'failed' then
    update public.messages
    set status = 'failed'
    where id = new.message_id
      and workspace_id = new.workspace_id
      and (status is null or status not in ('read', 'played', 'failed'));
    return new;
  end if;

  rank_new := case new.status
    when 'sent' then 3
    when 'delivered' then 4
    when 'read' then 5
    when 'played' then 6
    else null
  end;

  if rank_new is null then
    return new;
  end if;

  update public.messages
  set status = new.status
  where id = new.message_id
    and workspace_id = new.workspace_id
    and coalesce(
      case status
        when 'sent' then 3
        when 'delivered' then 4
        when 'read' then 5
        when 'played' then 6
        when 'failed' then 7
        else 0
      end,
      0
    ) < rank_new;

  return new;
end;
$$;

revoke all on function public.apply_latest_message_status()
  from public, anon, authenticated;

create trigger trg_apply_latest_message_status
  after insert on public.message_status_events
  for each row
  execute function public.apply_latest_message_status();
