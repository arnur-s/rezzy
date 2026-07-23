-- Extend messages with normalized provider fields needed for replies, edits,
-- deletions, and cross-provider lookups, and widen the type/status contracts
-- for the expanded inbound pipeline.
--
-- Column vs JSONB rule: each new column is joined, filtered, or rendered
-- directly (reply joins, edited/deleted state, provider-time ordering).
-- Everything else (entities, locations, contact cards, interactive payloads,
-- shares, forward origin, referral, quote context) stays in structured
-- messages.metadata namespaces; the full sanitized provider payload lives only
-- on provider_events.

alter table public.messages
  add column reply_to_message_id uuid references public.messages(id) on delete set null,
  add column external_reply_to_id text,
  add column edited_at timestamptz,
  add column deleted_at timestamptz,
  add column provider_timestamp timestamptz;

comment on column public.messages.reply_to_message_id is
  'Internal reply target when the referenced message row exists. Backfilled from external_reply_to_id when the parent arrives late.';
comment on column public.messages.external_reply_to_id is
  'Provider message id this message replies to; kept when the parent row is missing (out-of-order delivery).';
comment on column public.messages.edited_at is
  'Provider-reported edit time. Content holds the latest version; prior versions survive in provider_events.';
comment on column public.messages.deleted_at is
  'Provider-reported deletion time. Content is retained for audit but hidden in the ordinary UI.';
comment on column public.messages.provider_timestamp is
  'Message timestamp reported by the provider (may differ from created_at, which is receipt time).';

-- Telegram note: external_id previously stored the webhook update_id; from this
-- migration forward it stores the Telegram message_id (the provider message
-- identity used by replies/edits/reactions). Historic rows cannot be backfilled
-- because message_id was never captured. wamid (WhatsApp) and mid (Instagram)
-- semantics are unchanged.

alter table public.messages
  drop constraint if exists messages_type_check;

alter table public.messages
  add constraint messages_type_check
  check (
    type in (
      'text',
      'image',
      'video',
      'audio',
      'voice',
      'document',
      'sticker',
      'location',
      'contact',
      'interactive',
      'share',
      'story_reply',
      'story_mention',
      'system',
      'unsupported'
    )
  );

alter table public.messages
  drop constraint if exists messages_status_check;

alter table public.messages
  add constraint messages_status_check
  check (status in ('sent', 'delivered', 'read', 'played', 'failed'));

-- Status/reaction/reply handlers know the provider message id but not the
-- conversation; messages_unique_external_id keeps conversation scoping
-- (Telegram message ids are chat-scoped) so add a lookup index without it.
create index messages_workspace_external_id_idx
  on public.messages (workspace_id, external_id)
  where external_id is not null;

create index messages_reply_to_idx
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

-- Late-parent backfill: find children still pointing at an external reply id.
create index messages_external_reply_pending_idx
  on public.messages (conversation_id, external_reply_to_id)
  where external_reply_to_id is not null and reply_to_message_id is null;
