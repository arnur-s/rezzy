-- Durable sanitized provider-event archive. Every inbound webhook is split into
-- logical events (one row each), sanitized, and persisted BEFORE normalization,
-- so unhandled payloads are never silently lost and failed events can be
-- diagnosed and retried. Service-role only: no browser access, not in Realtime.
--
-- Idempotency: unique (channel_id, event_fingerprint). Fingerprints are
-- kind-prefixed provider ids (e.g. 'update:123', 'msg:wamid...', 'status:wamid:read')
-- or 'sha256:<hash>' of the canonical sanitized payload when no natural id exists.
--
-- Claim protocol for concurrent Edge Function instances:
--   1. insert ... status='processing' on conflict do nothing returning id
--   2. else: guarded update reclaim of temporary failures / stale 'processing' rows
--   3. neither returned a row -> duplicate delivery, ack without reprocessing.

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  provider text not null
    constraint provider_events_provider_check
    check (provider in ('telegram', 'whatsapp', 'instagram')),
  event_type text not null,
  event_fingerprint text not null,
  payload jsonb not null,
  status text not null default 'pending'
    constraint provider_events_status_check
    check (status in ('pending', 'processing', 'processed', 'ignored', 'failed')),
  error_kind text
    constraint provider_events_error_kind_check
    check (error_kind in ('temporary', 'permanent')),
  attempts integer not null default 0,
  last_error text,
  created_message_id uuid references public.messages(id) on delete set null,
  created_record_ids jsonb not null default '{}'::jsonb,
  provider_timestamp timestamptz,
  claimed_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.provider_events is
  'Sanitized inbound provider webhook events, one row per logical event. Service-role only. Raw source of truth for normalization, diagnostics, and reprocessing. Retention anchor: created_at.';
comment on column public.provider_events.provider is 'Messaging provider that delivered the event.';
comment on column public.provider_events.event_type is 'Provider-level event kind, e.g. message, edited_message, status, reaction, read, unsupported.';
comment on column public.provider_events.event_fingerprint is 'Kind-prefixed deterministic identity for dedup; sha256:<hash> of the canonical sanitized payload when the provider supplies no natural id.';
comment on column public.provider_events.payload is 'Sanitized provider payload. Never contains tokens, secrets, signatures, headers, or credential-bearing request details.';
comment on column public.provider_events.status is 'Processing state: pending | processing | processed | ignored | failed.';
comment on column public.provider_events.error_kind is 'Failure class: temporary (retryable via provider redelivery) or permanent (never retried).';
comment on column public.provider_events.attempts is 'Number of processing claims made for this event.';
comment on column public.provider_events.last_error is 'Safe diagnostic message for the most recent failure. Never raw payloads or secrets.';
comment on column public.provider_events.created_message_id is 'messages.id created from this event, when the event produced a message.';
comment on column public.provider_events.created_record_ids is 'Other normalized record ids created from this event, keyed by table, e.g. {"message_reactions": [...], "message_status_events": [...]}.';
comment on column public.provider_events.provider_timestamp is 'Timestamp reported by the provider for the event, when available.';
comment on column public.provider_events.claimed_at is 'When the current/last processing claim happened; used to reclaim stale processing rows.';
comment on column public.provider_events.processed_at is 'When the event reached a terminal state (processed/ignored/failed).';

create unique index provider_events_channel_fingerprint_key
  on public.provider_events (channel_id, event_fingerprint);

create index provider_events_workspace_created_idx
  on public.provider_events (workspace_id, created_at);

create index provider_events_status_idx
  on public.provider_events (status, claimed_at)
  where status in ('pending', 'processing', 'failed');

alter table public.provider_events enable row level security;

-- Service-role only: no policies, no anon/authenticated grants.
revoke all on public.provider_events from anon, authenticated;
grant select, insert, update, delete on public.provider_events to service_role;
