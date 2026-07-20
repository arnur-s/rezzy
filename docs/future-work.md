# Future work

Last updated: 2026-07-20

This is the handoff for unfinished work. The linked Supabase project is the
development environment; Rezzy has not been deployed to production.

## Current baseline

- Telegram is considered working, based on the owner's latest verification.
- WhatsApp receives inbound messages. Outbound messages/replies are implemented
  locally but are not yet proven end to end. The latest hosted attempt was
  rejected by Meta with HTTP 400, code 100, subcode 33
  (`GraphMethodException`): the configured sender object was not accessible to
  the supplied token/app.
- The supported interface languages are English and Russian only.
- Node.js is pinned to `24.18.0`, pnpm to `11.13.0`, and the Supabase CLI to
  `2.109.1`.
- The equivalent of `pnpm verify` passed on 2026-07-20: typecheck, lint, 110
  frontend tests, and the production build.
- A clean local migration replay and `pnpm test:db` passed on 2026-07-20: three
  pgTAP files with 58 assertions.
- The hosted development project has migrations
  `20260720090850_harden_function_privileges_and_data_api_grants.sql` and
  `20260720093622_optimize_rls_and_foreign_key_indexes.sql` applied.

The current working tree contains uncommitted setup, WhatsApp, test, and
Supabase changes. Several core WhatsApp files are still untracked. Preserve the
worktree: inspect and commit intentionally rather than resetting or discarding
files. Unrelated user changes may also be present. In particular, review the
existing deletion of `React-Claude-Skill-Package` separately instead of
restoring or including it automatically.

## P0: finish WhatsApp replies

The next product milestone is a reliable WhatsApp outbound reply flow. Do not
assume the Meta restriction is understood until the exact Graph API response is
captured.

1. The local `send-whatsapp-message` diagnostics were deployed and captured a
   failed hosted request on 2026-07-20: provider HTTP 400, code 100, subcode 33,
   type `GraphMethodException`. Continue to record the sanitized
   `provider_error` fields and trace ID when retesting. Never record access
   tokens, app secrets, customer message bodies, or phone numbers.
2. Confirm that the deployed `send-whatsapp-message` function matches the local
   implementation. Also verify the hosted function secrets, phone-number ID,
   WABA ID, token validity, and configured Graph API version. Local files alone
   do not prove what is deployed.
3. Resolve the specific Meta-side prerequisite reported by the API. Possible
   areas to verify include app/business verification, Tech Provider access,
   app permissions, number registration/status, and token ownership. Meta's
   requirements change, so use current official documentation instead of this
   file as the authority.
4. Test a free-form reply inside the active customer-service window. Decide the
   product behavior outside that window: implement approved template messages,
   or disable the composer with a clear explanation. Template sending is not
   implemented today.
5. The local send function now includes safe structured diagnostics for parsed
   Meta failures and invalid provider responses. After deployment, use the
   function's Logs view (not only Invocations) to capture them. Error code 190
   still produces the dedicated reconnect response; other Meta failures remain
   failed/502 responses and now include sanitized `provider_error` fields.
6. In-place reconnect is implemented locally and awaits hosted deployment and
   testing. It preserves the channel ID, name, conversations, and history;
   validates the replacement token/app/permissions, phone number, and WABA;
   keeps old credentials on provider validation failure; and reactivates the
   channel after a successful credential rotation. Token-expiry warnings and a
   reconnect action directly on failed messages are still pending.
7. Decide how to display WhatsApp contacts, interactive messages, buttons, and
   reactions. The webhook ingests common text/media/location types, but those
   interaction types currently degrade to an empty text message.
8. Add focused tests for signature verification, connect/code exchange,
   duplicate webhooks, media failures, delivery status, the send contract, and
   frontend channel dispatch. Mock Meta responses; automated tests must not
   send real messages. Add an Edge Function typecheck/test step to CI because
   `pnpm verify` does not currently validate Deno functions.

WhatsApp is complete when hosted-development testing confirms:

- Embedded Signup or the manual credential fallback creates a usable channel.
- Incoming text and supported media create the correct contact, conversation,
  and message records without duplicates.
- Outgoing text and supported media reach the customer.
- Delivery status progresses from accepted/sent to delivered/read, and failures
  remain failed rather than appearing successful.
- Expired credentials produce a clear reconnect path.
- Duplicate webhook events and repeated send requests are idempotent.
- Supported interactive payloads have a deliberate UI representation or an
  explicit documented fallback.
- Loading, error, and success text is correct in both English and Russian.

Relevant entry points:

- `src/features/channels/components/connect-whatsapp.tsx`
- `src/features/channels/components/reconnect-whatsapp-modal.tsx`
- `src/features/channels/lib/whatsapp-embedded-signup.ts`
- `src/features/inbox/api/messages.ts`
- `supabase/functions/whatsapp-connect-channel/`
- `supabase/functions/send-whatsapp-message/`
- `supabase/functions/whatsapp-webhook/`

Reconnect deployment smoke test:

1. Deploy the frontend and `whatsapp-connect-channel` Edge Function. No database
   migration is required for this reconnect implementation.
2. Confirm `WHATSAPP_APP_ID` and `WHATSAPP_APP_SECRET` are set on the Edge
   Function deployment so token ownership and permissions can be verified.
3. From the WhatsApp channel action menu, choose **Reconnect WhatsApp**. Use the
   same phone-number ID and matching WABA with a permanent system-user token
   carrying `whatsapp_business_messaging` and
   `whatsapp_business_management`.
4. Confirm the same channel ID remains active, then test an outbound free-form
   reply inside an active customer-service window and verify inbound delivery
   still reaches the existing conversation history.

## P1: production deployment

- Choose the frontend host and create a production Supabase project separate
  from the current hosted development project.
- Configure production Auth redirect URLs, browser-safe environment variables,
  Edge Function secrets, Meta allowed origins, and public webhook URLs.
- Apply reviewed migrations, regenerate linked TypeScript types, and deploy the
  exact Edge Function versions intended for production.
- Configure Meta and Telegram callbacks for production without disturbing the
  development callbacks.
- Define a repeatable deployment/rollback process and protect production
  secrets. Do not introduce a new deployment dependency without approval.
- Add operational visibility for failed functions, webhook rejection, expired
  provider credentials, and message-delivery failures.
- Run production smoke tests for authentication, workspace access, Telegram,
  WhatsApp inbound/outbound, file uploads, and English/Russian switching.

## P2: deferred product work

- Replace the current workspace-member invitation stub with a designed,
  email-based invitation flow, including roles, expiry, acceptance, revocation,
  and empty/error states.
- Instagram and email channels are intentionally shown as coming soon. Design
  their provider, credential, webhook, and message-capability workflows before
  enabling them.
- Seed/test personas and a formal branch/PR workflow were explicitly deferred
  and can be designed later.

## P3: deferred hardening and operations

- Perform the optional column-level grant audit for authenticated mutations on
  `channels`, `contacts`, `contact_channels`, `conversations`, `messages`, and
  `profiles`. If grants are narrowed, use a new migration and extend the pgTAP
  security contract; do not rewrite already-applied migrations.
- Workspace deletion is deliberately not exposed. If it becomes a product
  requirement, design the owner/admin workflow and tests before exposing
  `soft_delete_workspace`.
- The remaining `private.channel_secrets` advisor notice is intentional: the
  private schema is revoked from browser roles and credentials are accessed
  through service-only RPC helpers. Do not add a broad browser RLS policy merely
  to silence the notice.
- Revisit leaked-password protection when it is available for the project's
  Supabase plan and deployment requirements.
- Re-evaluate unused-index advisor notices only after production-like traffic
  exists. Do not remove indexes based on an empty development workload.
- Investigate the non-blocking build warnings for chunks larger than 500 kB and
  `lottie-web` direct `eval`; optimize only with measured impact.

For every future user-facing change, update both `messages/en.json` and
`messages/ru.json`. Additional languages are out of scope until requested.

## Local machine safety note

On 2026-07-20 Windows crashed with bugcheck `0xD1`
(`DRIVER_IRQL_NOT_LESS_OR_EQUAL`) while Docker Desktop had been used for local
Supabase. Windows reported `ks.sys` as possibly related and emitted Bluetooth
driver errors after reboot. This does not prove Docker caused the crash, but the
cause has not been established.

Do not automatically start Docker or local Supabase until the owner confirms
the machine is stable. Provider work can use the hosted development project.
The diagnostic dump is `C:\Windows\Minidump\072026-23468-01.dmp`; analyze it
with WinDbg before treating the incident as resolved.

## Resume checklist

1. Read this file and inspect `git status` without discarding existing work.
2. Ask the owner whether Docker/local Supabase is safe to start.
3. For WhatsApp work, reproduce and capture the exact sanitized Meta error
   before changing code or account configuration.
4. Run `pnpm verify` after code changes. For database changes, also run a clean
   local reset and `pnpm test:db` when local Docker use is approved.
5. Keep hosted-development and production actions explicit; never run a linked
   reset or expose service-role/provider secrets.
