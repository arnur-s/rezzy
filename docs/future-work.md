# Future work

Last updated: 2026-07-23

This file tracks unfinished product and integration work. The repository and its current implementation remain the source of truth; verify provider behavior against the deployed development environment before treating any integration as complete.

## Current baseline

- Telegram connection, inbound webhook ingestion, media handling, outbound sending, realtime inbox updates, and message-thread behavior are implemented.
- WhatsApp connection, inbound webhook ingestion, media handling, outbound sending, reconnect behavior, and delivery-status handling are implemented in the repository. Hosted end-to-end outbound verification is still required because the latest documented Meta attempt failed with HTTP 400, code 100, subcode 33 (`GraphMethodException`).
- Instagram professional-account OAuth connection/reconnection, webhook verification and ingestion, sender-profile lookup, media ingestion, outbound text/media sending, read-state updates, and channel UI are implemented in the repository. Hosted end-to-end verification and broader event coverage are still required.
- Conversation unread state is per agent rather than a shared `conversations.unread_count` value.
- The inbox includes optimistic/realtime deduplication work, virtualized message lists, browser-driven transcript regression tests, and desktop/push notification infrastructure.
- The supported interface languages are English and Russian.
- Use the versions and commands declared in `package.json`; do not copy version numbers from this handoff into task prompts.

## P0: preserve all useful provider data

The next cross-channel milestone is to retain the maximum useful data delivered by official Telegram, WhatsApp, and Instagram APIs while keeping the normalized inbox model reliable.

Required work:

1. Store sanitized raw provider events before normalization, with database-enforced idempotency and processing status.
2. Expand provider identity metadata without automatically merging contacts by display name or username.
3. Preserve reply context, edits, deletions, reactions, interactive payloads, locations, contact cards, story/post/reel shares, provider timestamps, delivery errors, and unknown event types.
4. Add structured attachment, reaction, and message-status history where those records improve queryability and auditability.
5. Keep credentials, authorization headers, signatures, webhook secrets, tokens, cookies, and service-role values out of raw-event storage and logs.
6. Keep customer media private in Supabase Storage and serve it through signed URLs.
7. Ensure duplicate or out-of-order provider callbacks do not duplicate messages, increment unread state twice, or regress delivery status.
8. Add focused database, Edge Function, and frontend tests for normalization, sanitization, idempotency, unsupported events, media failures, reactions, replies, edits/deletions, and status progression.

## P0: provider verification

### Telegram

- Re-run the full connect → inbound webhook → contact/conversation/message creation → realtime UI flow against the hosted development project.
- Verify text and all currently supported media types, duplicate webhook delivery, outbound retry/failure behavior, and inactive-channel handling.
- Extend Telegram update coverage deliberately rather than treating every update as a normal message.

### WhatsApp

- Confirm the deployed `send-whatsapp-message` function and hosted secrets match the repository.
- Resolve the Meta sender-object/token ownership failure and capture only sanitized provider diagnostics.
- Verify free-form replies inside the customer-service window and define product behavior outside it.
- Add deliberate handling for contacts, interactive replies, buttons, reactions, referral data, reply context, and unsupported payloads instead of degrading them to empty text rows.
- Verify duplicate webhook events, media failures, delivery/read callbacks, reconnect behavior, and expired credentials.

### Instagram

- Verify OAuth connect and reconnect against a hosted professional account.
- Verify inbound text/media, sender-profile synchronization, outbound text/media, read events, duplicate callbacks, expired tokens, and the 24-hour messaging window.
- Add deliberate handling for reactions, message deletion/unsupported flags, story mentions/replies, shares, reels, multiple attachments, and any provider events currently ignored by the MVP parser.
- Keep temporary profile/media URLs out of long-term UI assumptions.

## P1: production readiness

- Choose the frontend host and create a production Supabase project separate from development.
- Configure production Auth redirects, browser-safe environment variables, Edge Function secrets, provider origins, webhook URLs, and callback subscriptions.
- Apply reviewed migrations, regenerate linked types, and deploy the exact Edge Function versions intended for production.
- Define repeatable deployment, rollback, secret rotation, and provider reconnect procedures.
- Add operational visibility for failed functions, rejected webhooks, media ingestion failures, expired credentials, push failures, and message-delivery failures.
- Run production smoke tests for authentication, workspace isolation, all enabled channels, uploads, notifications, and English/Russian switching.

## P2: product work

- Replace the workspace-member invitation stub with a complete email invitation workflow, including roles, expiry, acceptance, revocation, loading, empty, and error states.
- Build the full contacts workspace using the existing contact data and inbox contact panel patterns.
- Define and implement manual contact merge/link workflows across provider identities.
- Design email-channel connection, threading, sending, and credential workflows before enabling it.
- Continue inbox UX hardening for channel capabilities, unsupported message fallbacks, retry actions, mobile behavior, and accessibility.

## P3: hardening and operations

- Add an Edge Function typecheck/test step to CI; frontend `pnpm verify` does not by itself validate every Deno function.
- Review authenticated mutation grants and extend pgTAP security contracts when narrowing permissions.
- Keep `private.channel_secrets` service-only; do not add broad browser access merely to silence an advisor notice.
- Re-evaluate unused indexes only with production-like traffic.
- Optimize large chunks or third-party warnings only when measurement shows meaningful impact.
- Define retention, redaction, deletion, and export policies for raw provider events and customer media.

## Resume checklist

1. Read `AGENTS.md` and inspect the current repository before using this handoff.
2. Inspect `git status` and never discard existing user changes.
3. Keep hosted-development and production actions explicit; never reset a linked project.
4. For provider work, verify current official API behavior and deployed configuration rather than trusting old handoff notes.
5. Run `pnpm verify` after broad code changes. Database changes also require the relevant migration replay, generated types, and `pnpm test:db` when local Supabase use is approved.
6. Never expose provider credentials, service-role keys, real customer payloads, or private media.
