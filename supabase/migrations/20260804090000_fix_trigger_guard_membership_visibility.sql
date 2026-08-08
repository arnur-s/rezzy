begin;

-- Three BEFORE-trigger guards validate a row against workspace_members or
-- profiles, but ran as the invoker. Both tables expose only the caller's own
-- row through RLS, so each guard was blind to every other user in the
-- workspace and drew the wrong conclusion from the empty result:
--
--   * ensure_conversation_assignee_is_workspace_member could not see a
--     coworker's membership, so assigning a thread to anybody but yourself
--     raised ASSIGNEE_NOT_WORKSPACE_MEMBER. The inbox assignee picker was
--     broken for its main use, and the optimistic update in
--     useUpdateConversationAssignee rolled the avatar back with no message.
--
--   * ensure_message_sender_is_valid could not see the sender's membership,
--     leaving SENDER_NOT_WORKSPACE_MEMBER reachable for a legitimate send.
--
--   * enforce_contact_note_integrity could not see another author's profile,
--     so its "was the author's profile deleted?" test was true for every
--     author but the caller. That let any member null out author_id on a
--     coworker's note, anonymising it and stripping the real author of the
--     delete right their own policy grants them.
--
-- These are guards, not writers: each does an existence check and either
-- raises or returns. Definer rights let them see the rows they are validating
-- against; the empty search path keeps a caller-controlled path from
-- redirecting the lookups. ensure_contact_owner_is_workspace_member, the
-- sibling that guards contacts.owner_id, has always been shaped this way.

create or replace function public.ensure_conversation_assignee_is_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null
    and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.assigned_to
    )
  then
    raise exception 'ASSIGNEE_NOT_WORKSPACE_MEMBER'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_conversation_assignee_is_workspace_member()
from public, anon, authenticated, service_role;

create or replace function public.ensure_message_sender_is_valid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'outbound' then
    if new.sender_id is null then
      raise exception 'OUTBOUND_SENDER_REQUIRED'
        using errcode = '23502';
    end if;

    -- auth.uid() is null for the service-role webhook and send paths, which
    -- legitimately write outbound rows on behalf of the original sender.
    if (select auth.uid()) is not null and new.sender_id <> (select auth.uid()) then
      raise exception 'OUTBOUND_SENDER_MUST_BE_CURRENT_USER'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = new.workspace_id
        and wm.user_id = new.sender_id
    ) then
      raise exception 'SENDER_NOT_WORKSPACE_MEMBER'
        using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.ensure_message_sender_is_valid()
from public, anon, authenticated, service_role;

create or replace function public.enforce_contact_note_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_workspace_id uuid;
  current_user_id uuid := (select auth.uid());
  author_profile_was_deleted boolean := false;
begin
  if tg_op = 'INSERT' then
    select c.workspace_id
    into contact_workspace_id
    from public.contacts c
    where c.id = new.contact_id;

    if contact_workspace_id is null then
      raise exception 'CONTACT_NOTE_CONTACT_NOT_FOUND'
        using errcode = '23503';
    end if;

    new.workspace_id := contact_workspace_id;
    new.body := btrim(new.body);

    if current_user_id is not null then
      new.author_id := current_user_id;

      select nullif(btrim(p.full_name), '')
      into new.author_name
      from public.profiles p
      where p.id = current_user_id;
    end if;

    return new;
  end if;

  -- Now that profiles is visible in full, this is true only when the author's
  -- profile is genuinely gone, which is the case the allowance exists for: the
  -- author_id FK is ON DELETE SET NULL, so the null arrives with the row.
  author_profile_was_deleted :=
    old.author_id is not null
    and new.author_id is null
    and not exists (
      select 1
      from public.profiles p
      where p.id = old.author_id
    );

  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.contact_id is distinct from old.contact_id
    or (
      new.author_id is distinct from old.author_id
      and not author_profile_was_deleted
    )
    or new.author_name is distinct from old.author_name
    or new.created_at is distinct from old.created_at
  then
    raise exception 'CONTACT_NOTE_IDENTITY_IMMUTABLE'
      using errcode = '23514';
  end if;

  new.body := btrim(new.body);

  if new.body is distinct from old.body
    and old.author_id is distinct from current_user_id
  then
    raise exception 'CONTACT_NOTE_BODY_AUTHOR_ONLY'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_contact_note_integrity()
from public, anon, authenticated, service_role;

commit;
