# Provider Data Model

Last updated 2026-07-23. How Rezzy stores Telegram, WhatsApp, and Instagram
data: the normalized CRM model, the sanitized raw-event archive, and the rules
that keep them correct under retries, concurrency, and out-of-order delivery.

## Normalized vs raw storage

- **Normalize into columns** anything queried, filtered, joined, rendered, or
  used by triggers: provider message id (`messages.external_id`), reply
  relationships, edited/deleted state, provider timestamp, latest status,
  attachment download state, reaction state, identity keys.
- **Keep in structured JSONB** provider-specific data read only at render time:
  `messages.metadata` namespaces (`telegram|whatsapp|instagram` ids,
  `entities`, `quote`, `forward_origin`, `location`, `contacts`,
  `interactive`, `share`, `story`, `referral`, `media_group_id`,
  `unsupported`, `system`, plus the legacy `upload_failed`/`upload_error`
  flags), `contact_channels.profile`, event/status/reaction/attachment
  `metadata`.
- **The full sanitized webhook payload lives only in `provider_events`** — it
  is never duplicated per normalized record.

## provider_events (service-role only)

One row per **logical event** (a WhatsApp POST carrying 3 messages + 2
statuses becomes 5 rows). Never exposed to the browser, never in Realtime.

- **Fingerprints** (unique per channel): Telegram `update:{update_id}`;
  WhatsApp `msg:{wamid}`, `status:{wamid}:{status}`; Instagram `msg:{mid}`,
  `reaction:{mid}:{sender}:{action}:{ts}`, `read:{sender}:{mid}`,
  `deleted:{mid}`, `echo:{mid}`; fallback `sha256:<hash>` of the canonical
  sanitized payload.
- **Claim protocol** (`claim_provider_event` RPC, atomic): insert
  `processing` on conflict do nothing → else reclaim `failed(temporary)` /
  `pending` / stale `processing` (>5 min) → else duplicate, ack without work.
- **Terminal states**: `processed` (with `created_message_id` /
  `created_record_ids`), `ignored` (deliberate skip, reason in `last_error`),
  `failed` with `error_kind` `temporary` (webhook returns non-2xx so the
  provider redelivers) or `permanent` (acked 200 — no retry loops).
- **Sanitization** (`_shared/sanitize.ts`, tested): deep denylist redaction of
  token/secret/signature/authorization/credential/password/cookie/api-key/
  `x-hub-*`/header keys, string truncation at 8 KB, depth cap. Logs carry only
  error names/codes and safe ids — never payloads, tokens, or phone numbers.

## Messages

`messages.external_id` **is** the provider message identity: Telegram
`message_id` (chat-scoped), WhatsApp `wamid`, Instagram `mid`. Uniqueness stays
`(workspace_id, conversation_id, external_id)` because Telegram message ids are
chat-scoped; a `(workspace_id, external_id)` lookup index serves status/
reaction/reply resolution. Inserts use `ON CONFLICT DO NOTHING` semantics
(23505 = successful dedup) — skipped duplicates fire no triggers, so previews,
per-agent unread, and notification fan-out can never double-apply.

> **Telegram legacy caveat**: rows created before 2026-07-23 stored the webhook
> `update_id` in `external_id`; the real `message_id` was never captured, so no
> backfill is possible. Edits/reactions targeting those rows are recorded as
> `ignored` provider events.

Message types: `text image video audio voice document sticker location contact
interactive share story_reply story_mention system unsupported`. Venue/live
locations are `location` + `metadata.location.kind`; button/list replies are
`interactive` + `metadata.interactive.kind`; unknown payloads become explicit
`unsupported` rows (never empty text) with the raw event in `provider_events`.

## Replies

`reply_to_message_id` (internal FK) + `external_reply_to_id` (provider id of a
parent not yet stored). Missing parents never reject a webhook; when the parent
arrives late, the pipeline backfills children (`messages_external_reply_pending_idx`).
Outbound replies resolve the parent's `external_id` and send Telegram
`reply_parameters` / WhatsApp `context.message_id` (Instagram has no reply
parameter).

## Status history

`message_status_events` is append-only (`queued sending accepted sent delivered
read played failed deleted unknown`) with safe provider diagnostics
(`error_code/subcode/type/trace_id`, `retryable`, WhatsApp conversation/pricing
objects in `metadata`). The `apply_latest_message_status` trigger projects onto
`messages.status` advance-only (`sent 3 < delivered 4 < read 5 < played 6`);
`failed` applies only before read/played and is terminal; `deleted` maps to
`messages.deleted_at`; queued/sending/accepted/unknown are history-only. Dedup:
provider webhooks dedup at `provider_events`; direct writers are guarded by the
partial unique `(message_id, status, provider_timestamp)`. Send functions
insert `sent`/`delivered` on success and `failed` with provider diagnostics on
failure (Telegram still reports `delivered` on API accept — it has no delivery
receipts).

## Reactions

`message_reactions`: one current-state row per `(channel_id,
provider_message_id, reactor_external_id, emoji)` flipped between
`added`/`removed` (removed rows kept for idempotency/audit), guarded by
`provider_timestamp` against out-of-order callbacks. Telegram sends full
old/new sets (diffed); WhatsApp replaces per reactor (empty emoji = remove all);
Instagram sends react/unreact. Reactions arriving before their message are
stored with null `message_id` and backfilled on message insert. Reactions do
not create notifications or unread state (deliberate).

## Attachments

`message_attachments`: multiple per message, unique `(message_id, position)`,
download-state machine `pending downloading stored failed skipped` with a safe
`failure_reason`. Telegram keeps both `provider_media_id` (file_id) and
`provider_media_unique_id` (file_unique_id); WhatsApp keeps the provider
`sha256` checksum. **Legacy dual-write**: attachment 0 also fills the
`messages.media_*` columns so existing rendering, previews, and push text keep
working; the frontend prefers `message_attachments` and falls back to legacy
columns. Media failures never reject the message; storage objects are removed
when a duplicate insert loses the race. Customer media stays in the private
`chat-media` bucket (25 MiB cap) behind signed URLs; provider/CDN URLs are
treated as temporary.

## Identities

`contact_channels` is the provider identity: unique `(channel_id,
external_id)` with stable external ids (Telegram numeric chat/user id, `wa_id`,
IGSID). Identities predating channel scoping (`channel_id IS NULL`) are adopted
on first webhook contact. `profile` JSONB holds officially supplied identity
metadata (`profile_synced_at` timestamps the sync):

- telegram: `user_id first_name last_name username language_code is_premium is_bot business_connection_id`
- whatsapp: `wa_id phone profile_name referral{source_type source_id ctwa_clid}`
- instagram: `username name profile_pic is_verified_user follower_count is_user_follow_business is_business_follow_user`

Contacts are **never merged** by name/username/avatar/phone-format heuristics;
one CRM contact may own many provider identities. WhatsApp backfills
`contacts.phone` only while it is null.

## Conversations and channels

`conversations.external_thread_id` (provider thread id) and `last_inbound_at`
(feeds WhatsApp/Instagram 24 h messaging-window checks). `channels` records
`api_version`, `last_webhook_at`, `last_outbound_at`, `last_error_at`,
`last_error_code`. Provider events only reopen conversations via the existing
designed inbound behavior — they never assign, close, or snooze.

## Webhook pipeline

verify signature/secret (constant-time) → parse → resolve the trusted channel
from provider identifiers (never body-supplied workspace ids) → split into
logical events → sanitize + claim `provider_events` → normalize (pure
per-provider `lib.ts`) → persist via `_shared` helpers with DB-enforced
idempotency → update conversation/notification state exactly once → mark the
event processed/ignored/failed → provider-compatible response (200 for
processed/ignored/duplicate/permanent-invalid; non-2xx only for temporary
failures).

Deliberately **ignored** events (kept as `ignored` provider events): Telegram
group/channel posts, callback/inline queries, business messages (no Business
setup), poll answers, membership events; Instagram echoes; WhatsApp statuses
for unknown messages. Deliberately **unsupported** message types: polls
(question preview kept), dice, WhatsApp orders, Instagram `is_unsupported`.

## Edits, deletions, retention

Edits update `content` (+`edited_at`); prior versions survive in
`provider_events`. Provider deletions set `deleted_at` — content is retained in
the database for audit but hidden in the ordinary UI. `provider_events.created_at`
is the retention anchor; a purge job (recommended 30–90 days) is deferred and
documented in `docs/future-work.md`. Deleting a workspace/channel/contact
cascades through events, messages, statuses, reactions, and attachments;
storage objects under `chat-media/{workspaceId}/…` require a separate cleanup
pass (existing behavior).

## Adding a new provider event

1. Extend the provider's `lib.ts` types + classifier/normalizer (pure, with
   fixture tests).
2. Pick a deterministic fingerprint (kind-prefixed natural id, else the
   sanitized-payload hash).
3. Persist through the `_shared` helpers; map the outcome to
   processed/ignored/failed(temporary|permanent).
4. If a new normalized shape is needed: focused migration + RLS + pgTAP, then
   `pnpm types:supabase:local`.
5. Render deliberately in the inbox (both message catalogs) or keep it an
   `ignored`/`unsupported` event — never let it crash or silently become text.

## Data intentionally not stored

Access/bot tokens, webhook secrets, signature headers, raw request headers,
service-role credentials (redacted before persistence); unofficial avatar
lookups for WhatsApp; Telegram non-private-chat content; provider CDN URLs as
permanent media references (downloaded into private storage instead); phone
numbers in logs.
