# Schema review 2026-08-09 — agent task prompts

Twelve prompts derived from a review of the database schema, its RLS policies, and
the edge functions that bypass them. Ordered by severity. Prompts 1–4 are
independent of each other; 5 depends on nothing but touches the same policies as
1; 8 and 12 should land after 1 so the constraint work is planned once.

Every prompt assumes the agent reads `AGENTS.md` first and treats the repository
as the source of truth. Findings below cite what the review saw on 2026-08-09 —
verify each still holds before changing anything.

---

## 1. Close the cross-workspace write paths on `conversations`

Read `AGENTS.md`, then inspect the current schema, policies, grants, and the
`supabase/functions/send-*` handlers before changing anything.

**Objective.** A member of workspace A can currently send a message through
workspace B's channel credentials. Close it at the schema, the policy, and the
edge-function layer — all three, not whichever is cheapest.

**The chain, as observed.** `conversations.channel_id` and
`conversations.contact_id` are single-column foreign keys; every other table in
the message graph received composite `(workspace_id, id)` foreign keys in
`supabase/migrations/20260804100300_message_graph_composite_workspace_fks.sql`,
whose header describes exactly this threat model but leaves `conversations`
out. The `conversations` UPDATE policy checks only `deleted_at IS NULL` and
`is_workspace_member(workspace_id)`, while `authenticated` holds a table-wide
UPDATE grant — so `channel_id` and `contact_id` are freely rewritable, unlike on
INSERT, where the policy verifies both belong to the workspace. Then
`send-whatsapp-message` (and `send-telegram-message`) load the channel by
`conversations.channel_id` and call `get_channel_credentials` on it without ever
comparing the channel's `workspace_id` to the message's.

`public.sync_contact_last_seen` is the same class of defect on its own:
SECURITY DEFINER, it updates `public.contacts` by `id` with no `workspace_id`
predicate, unlike the sibling triggers `cascade_contact_archive` and
`unarchive_on_inbound_message`, which both join on it.

**Scope.**

- Composite foreign keys from `conversations` to `channels` and `contacts` on
  `(workspace_id, …)`. Follow the replace-don't-supplement pattern and the
  `ON DELETE` column-list form the 20260804100300 migration established; two FKs
  over the same table pair make PostgREST embedding ambiguous.
- Stop `authenticated` from rewriting `conversations.channel_id` /
  `contact_id` and `contacts.workspace_id`. Prefer narrowing the column grants to
  what the app actually writes over adding policy predicates — check which
  columns the inbox and contacts features mutate before choosing the list.
- Add the missing `workspace_id` predicate to `sync_contact_last_seen`.
- Assert the channel's workspace matches the message's workspace in every send
  function, and consider whether `get_channel_credentials` should take the
  workspace and verify it rather than trusting its caller.

**Acceptance criteria.**

- A pgTAP test in `supabase/tests/database/` that fails on today's schema:
  as a member of workspace A, repointing a conversation at a channel or contact
  in workspace B is rejected.
- A test that an inbound message on a mis-scoped conversation cannot bump
  `last_seen_at` on a contact outside its workspace.
- Existing DB tests still pass; no regression in the inbox send path.
- `pnpm typecheck` after regenerating types, and `pnpm test:db`.

**Edge cases.** `conversations.contact_id` and `channel_id` are both NOT NULL, so
MATCH SIMPLE gives the composite the same coverage as the single-column FK —
confirm that before relying on it. Check for existing violating rows before
adding the constraints. The 20260804100300 migration documents why
`CREATE INDEX CONCURRENTLY` cannot appear in a migration here; read that note
before deciding how to build any supporting index.

---

## 2. Encrypt channel credentials at rest

Read `AGENTS.md`, then inspect `private.channel_secrets`, its RPC helpers, and
every edge function that reads or writes channel credentials.

**Objective.** Provider access tokens are stored as plaintext `jsonb`, so every
backup, dump, and replica carries live WhatsApp and Instagram credentials. The
`supabase_vault` extension is already installed and imported nowhere.

**Scope.** Move credential storage behind Vault (or an equivalent encrypted
representation), keeping the existing RPC surface — `get_channel_credentials`,
`upsert_channel_credentials`, `finalize_instagram_channel_connection` — as the
only access path, so callers do not change shape. While there: those three
accept an arbitrary `channel_id` with no workspace assertion. They are
service-role-only today, which is a grant, not a guarantee; decide whether to add
the assertion and say why in the migration header.

**Constraints.** Preserve the unique index that resolves a WhatsApp channel by
`credentials->>'phone_number_id'` — `get_whatsapp_channel_by_phone` depends on
it, and it cannot index an encrypted blob. Extracting that identifier into a
plain column on `private.channel_secrets` is likely the right move; it is not a
secret. Do not expose any credential path to `authenticated` or `anon`.

**Acceptance criteria.** Existing WhatsApp and Instagram send and webhook flows
work unchanged against the dev project. A DB test asserts no plaintext token
material is readable from `private.channel_secrets` by `service_role` without
going through the RPC. Migration includes the backfill for existing rows.

---

## 3. Fix push-subscription ownership on shared devices

Read `AGENTS.md`, then inspect `public.push_subscriptions`, its policies, and the
client code that registers and removes subscriptions.

**Objective.** `push_subscriptions.endpoint` is globally UNIQUE and the client
upserts with `onConflict: 'endpoint'`. When a second user signs in on a device
the first already registered, the `ON CONFLICT DO UPDATE` targets a row owned by
someone else, the UPDATE policy's USING fails, and the registration errors. The
first user's subscription stays live — so their message previews keep arriving on
a device now signed in as somebody else.

**Scope.** Make an endpoint transfer ownership to the current user on
re-registration, rather than failing. A SECURITY DEFINER RPC that deletes any
existing row for the endpoint and inserts the caller's is one option; changing
the key shape is another. Pick one and justify it in the migration.

**Acceptance criteria.** A DB test: user A registers an endpoint, user B
registers the same endpoint, B owns it and A has no row. The sign-out path still
removes the current user's subscription. Verify in a browser that push still
works after a sign-out/sign-in cycle as a different user.

**Edge cases.** Sign-out currently deletes by endpoint under the caller's RLS —
check it still behaves once ownership can move. Do not let one user delete
another's subscription for an endpoint they do not hold.

---

## 4. Make workspace soft-delete actually contain the workspace

Read `AGENTS.md`, then inspect `public.soft_delete_workspace`,
`public.is_workspace_member`, the `message_notifications` policies, the channel
lookup RPCs, and `supabase/migrations/20260805090300_deleted_workspaces_lose_child_access.sql`.

**Objective.** `is_workspace_member` returning false for a soft-deleted workspace
is meant to withdraw the whole workspace at once. Three paths escape it.

**The gaps, as observed.**

- `soft_delete_workspace` never deactivates channels, and
  `get_whatsapp_channel_by_phone` and `resolve_instagram_conversation` never check
  `workspaces.deleted_at`. Webhooks keep creating contacts, conversations, and
  messages in a workspace nobody can read, indefinitely.
- Both `message_notifications` policies are `recipient_id = auth.uid()` with no
  membership predicate. A removed member, or a member of a soft-deleted
  workspace, keeps reading conversation ids, message ids, and timestamps for it.
  `trg_clear_assignments_for_removed_member` clears assignments but not these.
- `archive_contact` and `restore_contact` check membership and role but not
  `workspaces.deleted_at`, unlike `list_archived_contacts` and
  `is_workspace_member`.

**Acceptance criteria.** DB tests covering each: an inbound webhook for a
soft-deleted workspace's channel is rejected or inert; a removed member reads no
notification rows for that workspace; archive/restore is refused in a
soft-deleted workspace. Decide deliberately whether removing a member should also
delete their notification rows, or whether the policy predicate is enough — say
which in the migration header.

**Edge cases.** Notification rows for a workspace a user later rejoins should
become visible again if the predicate approach is chosen; confirm that is the
intent. Deactivating channels on soft delete must not break restore, if restore
is ever built (see prompt 5).

---

## 5. Decide and build workspace membership management

Read `AGENTS.md` and `PRODUCT.md`, then inspect `public.workspace_members`, its
policies and grants, `public.list_workspace_members`, and the workspaces feature.

**Objective.** There is no way to invite, remove, or change the role of a
workspace member from the client: `workspace_members` has no UPDATE or DELETE
policy and `authenticated` holds only `SELECT, INSERT`. `invited_by` is written by
nothing. For a product built on multi-workspace shared inboxes, that is a missing
core capability, not a rough edge.

There is also a privilege path to close. The INSERT policy admits any row where
`role = 'owner'` and `workspaces.created_by = auth.uid()`, and the `workspaces`
SELECT policy keeps a creator visible through `created_by = auth.uid()`. So a
creator who is removed from their own workspace can re-insert themselves as
owner.

Related and worth resolving in the same pass: `soft_delete_workspace` is revoked
from PUBLIC and granted to no role, so workspace deletion is unreachable from the
app — `supabase/tests/database/workspace_lifecycle.test.sql` confirms this is
deliberate — while `src/api/types.ts` still advertises it as a callable RPC.
Either grant it and build the UI, or keep it unreachable and stop generating it
into the client surface.

**Scope.** This needs a product decision before implementation. Use
`superpowers:brainstorming` to settle the invite model (email invite versus
direct add, whether a pending-invite table is needed, who may change roles, the
last-owner rule) before writing any migration.

**Acceptance criteria.** Owners and admins can invite, change roles, and remove
members within the rules chosen. A workspace can never reach zero owners. A
removed creator cannot re-add themselves as owner. Every new path has a DB test
and respects the existing `is_workspace_member` boundary.

---

## 6. Correct the realtime archive mitigation

Read `AGENTS.md`, then
`docs/superpowers/specs/2026-08-08-archive-contacts-and-conversations-design.md`
§6 and the realtime hooks it names.

**Objective.** §6 lists three mitigations for archive events not reaching
subscribers. The second — "the UPDATE handler drops rather than merges any row
arriving with a non-null `deleted_at`. This covers admins, who do receive the
event" — cannot fire. The `contacts` and `conversations` SELECT policies both
require `deleted_at IS NULL`, so the post-archive row fails RLS for every
subscriber including the acting admin. That is the same reason
`list_archived_contacts` needs SECURITY DEFINER.

**Scope.** Confirm the analysis against the current policies. Then either correct
the design doc and remove the dead handler branch, or, if the stale-row window is
judged too wide now, implement the broadcast channel §6 considered and rejected.
Do not do both. Mitigations 1 and 3 are unaffected either way.

**Acceptance criteria.** The doc no longer claims a mitigation that cannot run.
If the handler branch is removed, no test was relying on it. If broadcast is
built, a member's list drops the row without a refetch.

---

## 7. Restore the RLS auto-enable event trigger

Read `AGENTS.md`, then inspect `public.rls_auto_enable`,
`supabase/tests/database/security_contract.test.sql`, and the two
`remote_schema` migrations that define the function.

**Objective.** The function exists and is asserted by the security-contract test,
but `CREATE EVENT TRIGGER` appears nowhere in the migrations or in a schema dump.
Any environment rebuilt from migrations has the function and not the control it
implements, while the linked project may have the trigger from a dashboard
setting. That is local/remote drift on a security guard.

**Scope.** Establish which environments actually have the event trigger. Then
either add it to a migration so every environment gets it, or delete the function
and its test assertions and record that RLS-on-new-tables is enforced by review.
The failure mode of leaving it as is — a new table in `public` silently shipping
without RLS locally, or without it in production — is what the fix must remove.

**Acceptance criteria.** A test that asserts the chosen outcome directly, not the
function's existence. If the trigger is added, a `supabase db reset` followed by
creating a table in `public` leaves RLS enabled.

---

## 8. Index the composite foreign keys and bound the unread scans

Read `AGENTS.md`, then inspect the current indexes, the unread-count RPCs, and
`search_workspace_contacts`. Measure before and after; do not add an index on the
strength of this description alone.

**Objective.** Three performance problems, all on paths the inbox hits on every
load.

- Composite foreign keys with referential actions and no supporting index:
  `provider_events (workspace_id, created_message_id)` and
  `message_status_events (workspace_id, provider_event_id)` are both
  `ON DELETE SET NULL`, and admins can hard-delete messages;
  `contact_phones (workspace_id, contact_id)` is `ON DELETE CASCADE` and neither
  existing index leads with `workspace_id`.
- `get_workspace_unread_counts` and `get_unread_counts_for_workspaces` left-join
  every inbound message of every conversation in the workspace, unbounded in
  time, on every inbox load.
- `search_workspace_contacts` computes `count(*) over ()` across the whole match
  set, and its `OR`'d `ILIKE` over three columns plus an `EXISTS` on
  `contact_channels` defeats `contacts_search_trgm_idx`. OFFSET pagination
  compounds it.

**Scope.** Add the missing FK indexes. For the unread counts, find a bound that
does not change the number the UI shows — the read cursor is per user and
per conversation, so counting only messages after it is the shape to aim at.
For contact search, decide whether the total count is worth its cost, and whether
the query can be restructured so the trigram indexes are usable.

**Constraints.** Read the locking note in the header of
`supabase/migrations/20260804100300_message_graph_composite_workspace_fks.sql`
before adding any index — `CREATE INDEX CONCURRENTLY` fails under
`supabase db reset`, and the workaround has a cost.

**Acceptance criteria.** `EXPLAIN (ANALYZE, BUFFERS)` before and after for each
of the three, on data representative of a busy workspace rather than the current
dev volumes. Unread counts return identical values. Redundant indexes identified
here should be handled in prompt 11, not this one.

---

## 9. Define and implement retention

Read `AGENTS.md` and `PRODUCT.md`, then inspect `provider_events`,
`message_notifications`, `message_status_events`, and `message_attachments`.

**Objective.** Three tables grow without bound and nothing prunes them.
`provider_events` stores full sanitized provider payloads and its own comment
names `created_at` as the "retention anchor", but no job acts on it and `pg_cron`
is not installed. `message_notifications` grows at members × inbound messages.
`message_status_events` is append-only by design.

**Scope.** This needs a decision on how long each is worth keeping and why —
debugging, audit, or billing — before any code. Use `superpowers:brainstorming`.
Then implement the smallest reliable mechanism; do not add a scheduler framework
for three deletes.

**Acceptance criteria.** A stated retention window per table, recorded where the
next person will find it. A mechanism that actually runs on the linked project,
verified, not just defined. Deletes must be batched so they do not hold long
locks on `messages`' children.

**Edge cases.** `provider_events.created_message_id` and
`message_status_events.provider_event_id` mean pruning one table nulls columns in
another — confirm that is acceptable for reconciliation before pruning. Storage
objects behind `message_attachments` are not deleted by a row delete.

---

## 10. Consolidate the message media model

Read `AGENTS.md`, then inspect `public.messages`, `public.message_attachments`,
`docs/provider-data-model.md`, and every reader of the `media_*` columns.

**Objective.** `messages.media_url`, `media_mime_type`, `media_size`, and
`media_filename` coexist with the `message_attachments` table, which supersedes
them for providers that permit multiple attachments. Nothing keeps the two
consistent, and `handle_inbound_message_insert` reads `media_filename` for its
preview text while attachments live elsewhere.

**Scope.** Establish which representation each ingress path writes today and
which the UI reads. Then converge on one, migrating existing rows. If the
`media_*` columns must stay for single-attachment messages, say what invariant
ties them to `message_attachments` and enforce it.

**Acceptance criteria.** One source of truth per message. Inbound media from
every connected provider renders unchanged. The conversation preview trigger
reads whatever survives. Existing rows are migrated, not left in the old shape
with new rows in the new one.

---

## 11. Schema hygiene sweep

Read `AGENTS.md`, then verify each item below against the current schema before
changing it — several may already be gone.

**Objective.** A batch of small, independent corrections. Keep them in one
migration with a header explaining the set, or split by table; do not spread them
across unrelated feature work.

- Redundant indexes: `idx_contacts_workspace` appears covered by four others;
  `idx_contact_channels_channel` by `uq_contact_channels_channel_external`;
  `idx_channel_secrets_wa_phone` by the unique partial index on the same
  expression; `idx_conversations_workspace_last_message` by its `_live` partial
  for live queries. `idx_messages_external_id` is global rather than
  workspace-scoped — confirm anything uses it before keeping it. Check
  `pg_stat_user_indexes` on the linked project rather than reasoning from shape
  alone.
- `contact_channels_channel_id_required` duplicates the column's NOT NULL.
- The `channel_id IS NULL OR …` branch in the `contact_channels` INSERT and
  UPDATE policies is unreachable now that the column is NOT NULL.
- `prevent_messages_for_inactive_channels` is the only function with
  `search_path = 'public'` rather than `''`, and being SECURITY INVOKER, RLS can
  hide the channel row and let its guard silently pass.
- The comment on `list_workspace_members` states `is_workspace_member` is
  SECURITY INVOKER; it is SECURITY DEFINER. The reasoning that follows depends on
  which it is.
- `messages_status_check` has no `queued` or `sending`, so the optimistic
  outbound state has no representation in the database; `status` is also nullable
  on top of having a default.
- `authenticated` holds table-wide UPDATE on `profiles`, so a user can set
  `email` to anything and desync it from `auth.users`. `full_name` has no length
  check though `job_title`, `phone`, and `timezone` do.
- `workspaces.updated_by` has no UPDATE grant and no trigger, so it is NULL
  except after a soft delete. `workspaces_name_length_check` validates
  `btrim(name)` while the column stores untrimmed text.

**Acceptance criteria.** Each change is independently justified in the migration.
Dropping an index is backed by usage statistics. `pnpm verify` passes.

---

## 12. Make the schema reproducible from scratch

Read `AGENTS.md`, then compare `supabase/migrations/` against a fresh
`supabase db reset` and against the linked project.

**Objective.** A schema dump taken from this project is not a runnable bootstrap,
and reads like one. It mixes `CREATE TABLE IF NOT EXISTS` and
`CREATE OR REPLACE TRIGGER` with plain `ALTER TABLE … ADD CONSTRAINT` and
`CREATE POLICY`, so re-running it fails partway. More importantly it omits three
things the migrations create: the `auth.users` → `on_auth_user_created` trigger,
the `chat-media` and avatar storage buckets with their policies, and the event
trigger from prompt 7. Restore from that dump and signup creates no profile while
media uploads have no bucket.

**Scope.**

- Establish what a from-scratch rebuild actually needs and where the authoritative
  path is — migrations, a dump, or both — and write it down where someone
  restoring at 3am will find it. If dumps are not a supported restore path, say
  so explicitly; the risk here is a plausible-looking file, not a missing one.
- No table in the `supabase_realtime` publication sets `REPLICA IDENTITY FULL`,
  so DELETE events carry only the primary key. Confirm whether any subscriber
  needs old-record values before deciding.
- Every enumerated domain is `text` plus a CHECK, so adding a message type or
  status means DROP/ADD CONSTRAINT under ACCESS EXCLUSIVE with a full scan of
  `messages`. Adopt `ADD CONSTRAINT … NOT VALID` followed by
  `VALIDATE CONSTRAINT` as the standard for future changes and record it.

**Acceptance criteria.** A documented, tested rebuild path. `pnpm test:db`
against a fresh reset. The constraint-change convention recorded where migration
authors will see it, with one migration demonstrating it.
