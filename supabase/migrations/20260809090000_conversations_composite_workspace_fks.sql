begin;

-- Close the cross-workspace write path on conversations.
--
-- 20260804100300 gave every table in the message graph a composite
-- (workspace_id, id) foreign key to its parent, and its header describes exactly
-- this threat model -- but it left conversations itself on single-column
-- foreign keys to channels and contacts. Meanwhile 20260808090000 rewrote the
-- conversations UPDATE policy for deleted_at, and in doing so replaced a WITH
-- CHECK that verified both parents were in the row's workspace with one that
-- checks only `deleted_at is null and is_workspace_member(workspace_id)`. The
-- INSERT policy still carries the verification; UPDATE stopped.
--
-- So the chain was: a member of workspace A points their own conversation at
-- workspace B's channel (workspace_id never changes, so the policy is content),
-- sends a message, and send-whatsapp-message resolves the channel from the
-- conversation and calls get_channel_credentials on it without ever comparing
-- the channel's workspace to the message's. Workspace A sends as workspace B.
--
-- Fixing one layer is not enough, because the three layers cover three
-- different writers:
--
--   the constraint  is the only thing that reaches service_role. The webhooks
--                   and send functions bypass RLS entirely; a policy cannot see
--                   them.
--   the grant       is what stops authenticated. Adding the predicate back to
--                   the UPDATE policy would work too, but the columns are not
--                   ones the app ever writes -- the inbox writes status and
--                   assigned_to, nothing else -- so removing the privilege says
--                   what is true and costs no per-statement subqueries.
--   the function    is defence in depth for rows that predate the constraint:
--                   sync_contact_last_seen resolves a contact through a
--                   conversation and then updates it by id alone.
--
-- The edge-function half of this change lives in supabase/functions/send-*: each
-- now loads the conversation and the channel scoped to the message's
-- workspace_id. get_channel_credentials keeps its single-argument shape. Three
-- of its eight callers -- whatsapp-webhook, telegram-webhook,
-- instagram-webhook -- resolve the channel from a provider identity and derive
-- the workspace from the channel, so a required workspace argument would be
-- circular there; the assertion belongs at the callers that have an independent
-- workspace to assert against. Whether that RPC should verify anything itself
-- is part of the credential-storage work, not this.

-- ── The constraint ───────────────────────────────────────────────────────────
--
-- Same shape and same reasoning as 20260804100300: UNIQUE (workspace_id, id) on
-- the parent (already present on both -- contacts from 20260731143003, channels
-- from 20260804100300), and each single-column foreign key REPLACED rather than
-- supplemented, because two foreign keys over the same table pair make
-- PostgREST resource embedding ambiguous.
--
-- Both columns are NOT NULL, so under MATCH SIMPLE the composite is checked in
-- exactly the cases the single-column constraint was. Neither old constraint
-- carried a referential action -- both are NO ACTION -- so there is none to
-- carry over and no column-list form to write.
--
-- No new index. Both referencing columns already lead an index
-- (idx_conversations_contact from 20260509120000,
-- conversations_channel_id_fkey_idx from 20260720093622), which is what the
-- parent-side NO ACTION check probes. The locking note in 20260804100300 --
-- CREATE INDEX CONCURRENTLY cannot appear in a migration here -- therefore does
-- not come into play.
--
-- Verified against a from-scratch `supabase db reset`: zero rows violate either
-- constraint. The linked project has not been checked from this environment; if
-- any row there disagrees, the ALTER below fails loudly on that row rather than
-- silently, which is the intended outcome.

alter table public.conversations
  drop constraint conversations_channel_id_fkey;

alter table public.conversations
  add constraint conversations_channel_workspace_fkey
  foreign key (workspace_id, channel_id)
  references public.channels (workspace_id, id);

alter table public.conversations
  drop constraint conversations_contact_id_fkey;

alter table public.conversations
  add constraint conversations_contact_workspace_fkey
  foreign key (workspace_id, contact_id)
  references public.contacts (workspace_id, id);


-- ── The grant ────────────────────────────────────────────────────────────────
--
-- authenticated held a table-wide UPDATE on both tables. What the application
-- actually writes, as of this migration:
--
--   conversations  status, assigned_to
--                    src/features/inbox/api/conversations.ts
--   contacts       name, phone, email, status, tags, owner_id
--                    src/features/contacts/api/contacts.ts
--                  phone again, through public.set_contact_phones, which is
--                    SECURITY INVOKER and so writes under the caller's grant
--
-- Everything else on those tables is written by a definer-rights function or by
-- service_role, neither of which is affected by a grant to authenticated:
-- last_message_at / last_message_preview / last_inbound_at by
-- handle_{in,out}bound_message_insert, assigned_to also by
-- handle_outbound_message_insert and clear_assignments_for_removed_member,
-- deleted_at by archive_contact / restore_contact / cascade_contact_archive /
-- unarchive_on_inbound_message, last_seen_at by sync_contact_last_seen,
-- updated_at by the BEFORE UPDATE handle_updated_at trigger (a trigger's write
-- to NEW is not a granted column write).
--
-- snoozed_until is deliberately not granted. conversations_status_check admits
-- 'snoozed' and the attention queue reads the column, but nothing writes it
-- yet; whichever change builds snoozing adds it here, and until then a narrow
-- grant is the honest description of the surface.
--
-- INSERT keeps its table-wide grant on both tables. The conversations INSERT
-- policy still verifies that contact and channel are in the row's workspace,
-- and the contacts INSERT policy verifies workspace membership, so neither
-- insert path is a way in.

revoke update on table public.conversations from authenticated;
grant update (status, assigned_to) on table public.conversations
  to authenticated;

revoke update on table public.contacts from authenticated;
grant update (name, phone, email, status, tags, owner_id)
  on table public.contacts to authenticated;


-- ── The function ─────────────────────────────────────────────────────────────
--
-- sync_contact_last_seen read contact_id out of public.conversations with no
-- workspace predicate and then updated public.contacts by id alone -- the one
-- inbound-path trigger that did. Its siblings cascade_contact_archive and
-- unarchive_on_inbound_message both join contact to conversation on
-- workspace_id, and this now matches them.
--
-- The composite foreign key above makes a conversation whose contact lives in
-- another workspace unwritable, so on a clean database this predicate can no
-- longer change an outcome. It is here for the rows written before that
-- constraint existed, and so the guard does not silently depend on a constraint
-- added in a different migration.

create or replace function public.sync_contact_last_seen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction <> 'inbound' then
    return null;
  end if;

  update public.contacts c
  set
    last_seen_at = greatest(coalesce(c.last_seen_at, new.created_at),
                            new.created_at),
    updated_at = now()
  from public.conversations cv
  where cv.id = new.conversation_id
    and cv.workspace_id = new.workspace_id
    and c.id = cv.contact_id
    and c.workspace_id = new.workspace_id;

  return null;
end;
$$;

comment on function public.sync_contact_last_seen() is
  'Advances public.contacts.last_seen_at on an inbound message. Every join is pinned to the message''s workspace_id so the update cannot reach a contact outside it, independently of the composite foreign keys on public.conversations.';

commit;
