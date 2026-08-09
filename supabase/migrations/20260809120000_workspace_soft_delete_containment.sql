begin;

-- 20260805090300 put `workspaces.deleted_at is null` into is_workspace_member()
-- so that a soft delete withdraws the whole workspace at once: every child table
-- authorises through that one function, so they all stop together. Three paths
-- never went through it, and each one survived the delete.
--
--   1. The service-role webhook ingress. get_whatsapp_channel_by_phone() and
--      resolve_instagram_conversation() resolve a channel with no reference to
--      the workspace's own state, and every webhook runs as service_role, where
--      RLS -- and therefore is_workspace_member() -- never executes. Inbound
--      messages kept creating contacts, conversations and messages inside a
--      workspace no human could open, for as long as the provider kept
--      delivering.
--   2. public.message_notifications. Both policies were `recipient_id =
--      auth.uid()` and nothing else, so the one table in the message graph that
--      does not authorise through is_workspace_member() kept handing a removed
--      member -- or any member of a soft-deleted workspace -- conversation ids,
--      message ids and arrival times for it.
--   3. archive_contact() / restore_contact(). Both check membership and role by
--      reading workspace_members directly, and both omit the join to workspaces
--      that their sibling list_archived_contacts() already carries.
--
-- ── Why channels are not deactivated ─────────────────────────────────────────
--
-- The obvious alternative for (1) is for soft_delete_workspace() to set
-- channels.is_active = false, since every webhook and every send path already
-- gates on that column. It is rejected here. `is_active` describes the provider
-- connection -- whether this Telegram bot or WhatsApp number is currently
-- wired up -- and a workspace's `deleted_at` describes the workspace. Copying
-- one into the other creates two facts that have to be resynchronised, and the
-- resynchronisation is not recoverable: once the flag is overwritten there is no
-- record of which channels were deliberately switched off beforehand, so a
-- restore either leaves working channels dead or reactivates channels an admin
-- had turned off on purpose. 20260805090300 chose a derived predicate over a
-- copied flag for exactly this reason, and said so: "restoration stays a single
-- flag flip". It still does after this migration.
--
-- The guard therefore goes where the workspace is read, not where it is copied.
-- Telegram is the one ingress with no lookup RPC -- telegram-webhook selects
-- public.channels by id as service_role -- so its guard lives in the edge
-- function alongside the Instagram one, and only the two RPCs below are
-- testable from pgTAP.


-- =========================================================
-- 1. Webhook channel resolution
-- =========================================================

-- Unchanged from 20260809100000 apart from the join. A soft-deleted workspace
-- returns no row, which whatsapp-webhook already treats as "not a channel we
-- know" and skips -- the webhook is answered 200 and nothing is written, so
-- Meta does not retry a delivery that will never be accepted.
create or replace function public.get_whatsapp_channel_by_phone(
  p_phone_number_id text
)
returns table(channel_id uuid, workspace_id uuid, is_active boolean)
language sql
security definer
set search_path = ''
as $$
  select c.id, c.workspace_id, c.is_active
  from private.channel_secrets s
  join public.channels c on c.id = s.channel_id
  join public.workspaces w on w.id = c.workspace_id
  where c.type = 'whatsapp'
    and s.whatsapp_phone_number_id = nullif(btrim(p_phone_number_id), '')
    and w.deleted_at is null
  limit 1
$$;

comment on function public.get_whatsapp_channel_by_phone(text) is
  'Routes an inbound WhatsApp webhook to its channel by the payload phone_number_id. Returns nothing for a channel whose workspace has been soft deleted, so ingestion stops with the rest of the workspace.';

-- Unchanged from 20260722120000 apart from the same join and the widened
-- exception text. The workspace is derived here rather than passed in, and it is
-- the value every row this function creates is stamped with, so gating the
-- lookup gates the contact, the contact_channel and the conversation together.
-- instagram-webhook logs a resolve failure and moves to the next event, so a
-- delete is inert for the caller rather than fatal.
create or replace function public.resolve_instagram_conversation(
  p_channel_id uuid,
  p_external_id text,
  p_external_name text default null,
  p_name text default null,
  p_avatar_url text default null
)
returns table(contact_id uuid, contact_channel_id uuid, conversation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
-- The OUT column names (contact_id, conversation_id) collide with table columns
-- referenced in ON CONFLICT targets; prefer the column in ambiguous cases.
#variable_conflict use_column
declare
  v_workspace_id uuid;
  v_contact_id uuid;
  v_contact_channel_id uuid;
  v_conversation_id uuid;
begin
  select c.workspace_id into v_workspace_id
  from public.channels c
  join public.workspaces w on w.id = c.workspace_id
  where c.id = p_channel_id
    and c.type = 'instagram'
    and w.deleted_at is null;

  -- One message for "no such channel" and "its workspace is gone": the caller is
  -- a webhook that does the same thing either way, and the two are not worth
  -- distinguishing in a log line.
  if v_workspace_id is null then
    raise exception 'unknown or unavailable Instagram channel %', p_channel_id;
  end if;

  select cc.id, cc.contact_id
    into v_contact_channel_id, v_contact_id
  from public.contact_channels cc
  where cc.channel_id = p_channel_id and cc.external_id = p_external_id;

  if v_contact_channel_id is null then
    insert into public.contacts (workspace_id, name, avatar_url, source, status)
    values (v_workspace_id, p_name, p_avatar_url, 'instagram', 'new')
    returning id into v_contact_id;

    insert into public.contact_channels
      (contact_id, workspace_id, channel_id, channel_type, external_id, external_name)
    values
      (v_contact_id, v_workspace_id, p_channel_id, 'instagram', p_external_id, p_external_name)
    on conflict (channel_id, external_id) do nothing
    returning id into v_contact_channel_id;

    if v_contact_channel_id is null then
      -- Lost the race: drop our orphan contact and adopt the winner.
      delete from public.contacts where id = v_contact_id;
      select cc.id, cc.contact_id
        into v_contact_channel_id, v_contact_id
      from public.contact_channels cc
      where cc.channel_id = p_channel_id and cc.external_id = p_external_id;
    end if;
  else
    update public.contact_channels
    set external_name = coalesce(p_external_name, external_name)
    where id = v_contact_channel_id;
  end if;

  insert into public.conversations as conv
    (workspace_id, contact_id, channel_id, status)
  values
    (v_workspace_id, v_contact_id, p_channel_id, 'open')
  on conflict (contact_id, channel_id) do update
    set status = 'open'
    where conv.status <> 'open'
  returning conv.id into v_conversation_id;

  if v_conversation_id is null then
    select conv.id into v_conversation_id
    from public.conversations conv
    where conv.contact_id = v_contact_id and conv.channel_id = p_channel_id;
  end if;

  return query select v_contact_id, v_contact_channel_id, v_conversation_id;
end;
$$;

comment on function public.resolve_instagram_conversation(uuid, text, text, text, text) is
  'Race-safe resolve-or-create of contact, contact_channel and conversation for an inbound Instagram message. Raises for a channel whose workspace has been soft deleted, so ingestion stops with the rest of the workspace.';

-- CREATE OR REPLACE preserves privileges, so the service_role-only grants from
-- 20260722120000 and 20260809100000 still stand. Asserted in
-- channel_credentials.test.sql and instagram_channel.test.sql.


-- =========================================================
-- 2. message_notifications
-- =========================================================
--
-- ── Predicate, not deletion ──────────────────────────────────────────────────
--
-- The alternative was to delete a member's notification rows when their
-- workspace_members row goes, next to trg_clear_assignments_for_removed_member.
-- The predicate is chosen instead, for three reasons:
--
--   * Deletion does not cover the second case at all. Memberships are retained
--     across a soft delete on purpose (20260805090300), so there is no DELETE to
--     hang a trigger on and a member of a soft-deleted workspace would keep
--     reading their rows. The predicate covers both cases with one clause; a
--     deletion trigger would cover a strict subset and still need it.
--   * It is reversible in the direction the product needs. A member who is
--     re-added, or a workspace that is restored, gets their notification history
--     back with read_at intact -- rather than a bell that has forgotten
--     everything it already showed them. That is the intended behaviour, not an
--     accident of the mechanism.
--   * Notification rows are the record of what was delivered to whom.
--     Withdrawing access to them is a membership question; destroying them is
--     a retention question, and retention for this table is not decided yet.
--
-- What it does not do is stop the rows accumulating for a user who will never
-- read them again. That is retention, it applies to far more than departed
-- members, and it belongs with the rest of it.
--
-- create_message_notifications() is unchanged: it already joins
-- workspace_members, so it writes no new rows for a non-member. It does not
-- check deleted_at because it does not need to -- after this migration nothing
-- can insert an inbound message into a soft-deleted workspace to trigger it.

drop policy if exists "Recipients can view own notifications"
  on public.message_notifications;
create policy "Recipients can view own notifications"
  on public.message_notifications
  for select
  to authenticated
  using (
    recipient_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  );

-- read_at is the only updatable column (the grant is `update (read_at)`), so
-- this predicate governs marking read. mark_conversation_read() is SECURITY
-- INVOKER and already refuses a non-member before it gets here, so the two
-- agree rather than one masking the other.
drop policy if exists "Recipients can update own notifications"
  on public.message_notifications;
create policy "Recipients can update own notifications"
  on public.message_notifications
  for update
  to authenticated
  using (
    recipient_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  )
  with check (
    recipient_id = (select auth.uid())
    and public.is_workspace_member(workspace_id)
  );

comment on table public.message_notifications is
  'Per-recipient delivery records for inbound messages, written only by trg_create_message_notifications. A recipient reads their own rows for as long as they are a member of a workspace that has not been soft deleted; the rows survive removal so a re-added member gets their history, and their read state, back.';


-- =========================================================
-- 3. archive_contact / restore_contact
-- =========================================================
--
-- The guard becomes the one list_archived_contacts already uses, so all three
-- entry points of the archive feature agree on what a workspace admin is. The
-- error is unchanged: to a caller in a deleted workspace the contact is not
-- theirs to archive, which is the same answer as for a contact in somebody
-- else's workspace, and distinguishing them would report the existence of the
-- workspace.

create or replace function public.archive_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  select c.workspace_id
  into v_workspace_id
  from public.contacts c
  where c.id = p_contact_id;

  if v_workspace_id is null or not exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = v_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
      and w.deleted_at is null
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  update public.contacts
  set
    deleted_at = now(),
    updated_at = now()
  where id = p_contact_id
    and deleted_at is null;
end;
$$;

create or replace function public.restore_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  select c.workspace_id
  into v_workspace_id
  from public.contacts c
  where c.id = p_contact_id;

  if v_workspace_id is null or not exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = v_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
      and w.deleted_at is null
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  update public.contacts
  set
    deleted_at = null,
    updated_at = now()
  where id = p_contact_id
    and deleted_at is not null;
end;
$$;

commit;
