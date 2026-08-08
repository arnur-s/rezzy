begin;

-- Every table touched here carries workspace_id next to a single-column foreign
-- key to a parent that carries its own workspace_id, and nothing forced the two
-- to agree. RLS reads the child's workspace_id, so a row whose parent lives in
-- another workspace is served under the wrong workspace -- and the writers most
-- likely to produce one are exactly the writers RLS does not police. The
-- provider webhooks and the send-* functions run as service_role and bypass RLS
-- entirely: a webhook that resolved the wrong channel could write a message with
-- workspace A's workspace_id hanging off a conversation in workspace B, and
-- workspace A would then read a stranger's conversation. Policies cannot catch
-- that; only a table constraint can.
--
-- The shape is the one contact_notes, contact_phones and contact_channels
-- already use: UNIQUE (workspace_id, id) on the parent, composite FK from the
-- child.
--
-- Each single-column FK is REPLACED rather than supplemented. Two foreign keys
-- over the same pair of tables make PostgREST resource embedding ambiguous --
-- the reason 20260722120000 gave for enforcing the contacts side of
-- contact_channels with a trigger instead of a second FK. Replacing loses
-- nothing: workspace_id is NOT NULL on every child below, so under MATCH SIMPLE
-- the composite is checked in exactly the cases the single-column FK was, and
-- skipped only where the child's parent column is itself nullable and null,
-- which is what the old constraint did too. No application code references the
-- old constraint names; only the generated types do, and they are regenerated.
--
-- ON DELETE actions are carried over unchanged. Where the old action was SET
-- NULL, the composite uses the PostgreSQL 15+ column list form so the referential
-- action nulls the parent column alone -- nulling workspace_id would violate its
-- NOT NULL and turn a parent delete into an error.
--
-- Checked against the linked project before writing this: zero rows violate any
-- of these twelve constraints.
--
-- Locking, and why there is no CREATE INDEX CONCURRENTLY here. messages is the
-- largest table in the schema, so its UNIQUE (workspace_id, id) is the one build
-- worth taking out of line -- but it cannot be. `supabase db reset` sends a
-- migration's statements as a pipeline, and CREATE INDEX CONCURRENTLY fails
-- inside one with 25001 regardless of how the files are split (`supabase
-- migration up` happens to accept it, which makes this easy to miss: the
-- incremental path passes and the from-scratch path every other developer and CI
-- runs does not). So the index is built ordinarily, under the transaction below,
-- along with the FK validation scans.
--
-- That is sized for today's data: messages is ~1.1k rows on the linked project,
-- message_notifications ~125, everything else double digits. If this schema
-- reaches a scale where an ACCESS EXCLUSIVE on messages is not acceptable, the
-- index and the constraints have to be created out of band -- psql against the
-- database directly, then recorded in supabase_migrations -- because the
-- migration runner cannot express it.

-- ── Composite-FK targets ─────────────────────────────────────────────────────

alter table public.messages
  add constraint messages_workspace_id_id_key unique (workspace_id, id);

alter table public.conversations
  add constraint conversations_workspace_id_id_key unique (workspace_id, id);

-- channels already has UNIQUE (id, workspace_id, type) for the contact_channels
-- composite, but a two-column FK needs a two-column unique to match.
alter table public.channels
  add constraint channels_workspace_id_id_key unique (workspace_id, id);

alter table public.provider_events
  add constraint provider_events_workspace_id_id_key unique (workspace_id, id);

-- ── messages ─────────────────────────────────────────────────────────────────

alter table public.messages
  drop constraint messages_conversation_id_fkey;

alter table public.messages
  add constraint messages_conversation_workspace_fkey
  foreign key (workspace_id, conversation_id)
  references public.conversations (workspace_id, id);

-- Self-referential: a quoted reply must quote a message in its own workspace.
-- _shared/persist.ts backfills this column from provider payloads under
-- service_role, so it is reachable by the same class of bug as the rest.
alter table public.messages
  drop constraint messages_reply_to_message_id_fkey;

alter table public.messages
  add constraint messages_reply_to_workspace_fkey
  foreign key (workspace_id, reply_to_message_id)
  references public.messages (workspace_id, id)
  on delete set null (reply_to_message_id);

-- ── message_attachments ──────────────────────────────────────────────────────

alter table public.message_attachments
  drop constraint message_attachments_message_id_fkey;

alter table public.message_attachments
  add constraint message_attachments_message_workspace_fkey
  foreign key (workspace_id, message_id)
  references public.messages (workspace_id, id)
  on delete cascade;

-- ── message_status_events ────────────────────────────────────────────────────

alter table public.message_status_events
  drop constraint message_status_events_message_id_fkey;

alter table public.message_status_events
  add constraint message_status_events_message_workspace_fkey
  foreign key (workspace_id, message_id)
  references public.messages (workspace_id, id)
  on delete cascade;

alter table public.message_status_events
  drop constraint message_status_events_provider_event_id_fkey;

alter table public.message_status_events
  add constraint message_status_events_provider_event_workspace_fkey
  foreign key (workspace_id, provider_event_id)
  references public.provider_events (workspace_id, id)
  on delete set null (provider_event_id);

-- ── provider_events ──────────────────────────────────────────────────────────

alter table public.provider_events
  drop constraint provider_events_channel_id_fkey;

alter table public.provider_events
  add constraint provider_events_channel_workspace_fkey
  foreign key (workspace_id, channel_id)
  references public.channels (workspace_id, id)
  on delete cascade;

alter table public.provider_events
  drop constraint provider_events_created_message_id_fkey;

alter table public.provider_events
  add constraint provider_events_created_message_workspace_fkey
  foreign key (workspace_id, created_message_id)
  references public.messages (workspace_id, id)
  on delete set null (created_message_id);

-- ── message_reactions ────────────────────────────────────────────────────────

-- message_id and conversation_id are nullable here on purpose: a reaction can
-- arrive before the message it reacts to, and is reconciled later. MATCH SIMPLE
-- leaves those pending rows unconstrained, exactly as the single-column FKs did.
alter table public.message_reactions
  drop constraint message_reactions_message_id_fkey;

alter table public.message_reactions
  add constraint message_reactions_message_workspace_fkey
  foreign key (workspace_id, message_id)
  references public.messages (workspace_id, id)
  on delete cascade;

alter table public.message_reactions
  drop constraint message_reactions_conversation_id_fkey;

alter table public.message_reactions
  add constraint message_reactions_conversation_workspace_fkey
  foreign key (workspace_id, conversation_id)
  references public.conversations (workspace_id, id)
  on delete cascade;

alter table public.message_reactions
  drop constraint message_reactions_channel_id_fkey;

alter table public.message_reactions
  add constraint message_reactions_channel_workspace_fkey
  foreign key (workspace_id, channel_id)
  references public.channels (workspace_id, id)
  on delete cascade;

-- ── message_notifications ────────────────────────────────────────────────────

alter table public.message_notifications
  drop constraint message_notifications_message_id_fkey;

alter table public.message_notifications
  add constraint message_notifications_message_workspace_fkey
  foreign key (workspace_id, message_id)
  references public.messages (workspace_id, id)
  on delete cascade;

alter table public.message_notifications
  drop constraint message_notifications_conversation_id_fkey;

alter table public.message_notifications
  add constraint message_notifications_conversation_workspace_fkey
  foreign key (workspace_id, conversation_id)
  references public.conversations (workspace_id, id)
  on delete cascade;

commit;
