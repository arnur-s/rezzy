begin;

-- The three entry points for archiving. All SECURITY DEFINER with an explicit
-- owner/admin check, following public.soft_delete_workspace.
--
-- Definer is not a convenience here. 20260808090000 put `deleted_at is null`
-- into both the SELECT and the UPDATE policies, so:
--
--   * a PostgREST `.update({deleted_at}).select()` fails twice over -- the WITH
--     CHECK rejects the new row, and the returning read cannot see it;
--   * restore writes a row whose deleted_at is NOT null, which the UPDATE
--     policy hides from every caller;
--   * the archived list reads rows no SELECT policy admits.
--
-- Authority is owner/admin, matching exactly what the DELETE policies dropped in
-- 20260808090000 used to grant. This replaces that authority rather than
-- widening it.


-- =========================================================
-- 1. archive_contact
-- =========================================================
--
-- Conversations are not touched here: trg_cascade_contact_archive carries
-- deleted_at to them inside this same transaction. Keeping the cascade in the
-- trigger means it cannot be bypassed by a writer that never calls this
-- function.

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

  -- Read the workspace from the contact rather than taking it as a parameter:
  -- a caller-supplied workspace id would have to be checked against the row
  -- anyway, and this cannot disagree with it.
  select c.workspace_id
  into v_workspace_id
  from public.contacts c
  where c.id = p_contact_id;

  -- Same error for "no such contact" and "not an admin here". A definer function
  -- that distinguishes them tells any authenticated caller whether an arbitrary
  -- uuid names a real contact.
  if v_workspace_id is null or not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = v_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  -- `deleted_at is null` makes this idempotent and keeps a second call from
  -- moving the timestamp -- and, through the trigger's WHEN clause, from
  -- re-stamping conversations that were already archived.
  update public.contacts
  set
    deleted_at = now(),
    updated_at = now()
  where id = p_contact_id
    and deleted_at is null;
end;
$$;

comment on function public.archive_contact(uuid) is
  'Archives one contact and, through trg_cascade_contact_archive, its conversations. Owner/admin only. Archiving hides rows; it scrubs nothing, and an inbound message from the same contact reverses it automatically.';

revoke all on function public.archive_contact(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.archive_contact(uuid) to authenticated;


-- =========================================================
-- 2. restore_contact
-- =========================================================
--
-- The inverse, and the reason "archive" is not just a slower delete. Because
-- conversations are never archived on their own, every conversation of this
-- contact shares its state and the cascade can clear all of them without having
-- to remember which were already hidden beforehand.

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
    where wm.workspace_id = v_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
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

comment on function public.restore_contact(uuid) is
  'Clears public.contacts.deleted_at and, through trg_cascade_contact_archive, that of its conversations. Owner/admin only. A restored conversation returns with the status, assignee and read cursors it had, so one archived while unread comes back unread.';

revoke all on function public.restore_contact(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.restore_contact(uuid) to authenticated;


-- =========================================================
-- 3. list_archived_contacts
-- =========================================================
--
-- The single guarded hole through the SELECT policy -- the same shape of narrow
-- exception as public.list_workspace_members, which is how the member roster
-- gets past own-row RLS.
--
-- Returns display_name computed exactly as search_workspace_contacts computes
-- it, so an archived row renders identically to a live one. It deliberately does
-- NOT return a route target: an archived contact has a row and a Restore button,
-- not a detail page.

create or replace function public.list_archived_contacts(
  p_workspace_id uuid,
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  display_name text,
  phone text,
  email text,
  avatar_url text,
  status text,
  source text,
  tags text[],
  owner_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  channel_types text[],
  conversation_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  -- This guard is the only thing between a caller and every archived contact in
  -- the workspace, including the PII the archive deliberately preserves.
  if not exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
      and w.deleted_at is null
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  if v_query is not null then
    v_query := left(v_query, 128);
    -- Backslash first, or the escapes introduced by the next two replaces get
    -- escaped in turn.
    v_pattern := '%'
      || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_')
      || '%';
  end if;

  return query
  with matched as (
    select
      c.id as contact_id,
      dn.display_name,
      count(*) over () as match_total,
      row_number() over (
        -- Most recently archived first: the row somebody wants to restore is
        -- almost always the one they just archived by mistake. The trailing key
        -- makes the order total, so no row is skipped or repeated across pages.
        order by c.deleted_at desc, c.id desc
      ) as sort_rank
    from public.contacts c
    left join lateral (
      select coalesce(
        nullif(btrim(c.name), ''),
        (
          select nullif(btrim(cc.external_name), '')
          from public.contact_channels cc
          where cc.contact_id = c.id
            and cc.workspace_id = c.workspace_id
            and nullif(btrim(cc.external_name), '') is not null
          order by cc.created_at asc, cc.id asc
          limit 1
        )
      ) as display_name
    ) dn on true
    where c.workspace_id = p_workspace_id
      and c.deleted_at is not null
      and (
        v_pattern is null
        or c.name ilike v_pattern
        or c.email ilike v_pattern
        or c.phone ilike v_pattern
      )
  ),
  page as (
    select m.contact_id, m.display_name, m.match_total, m.sort_rank
    from matched m
    order by m.sort_rank
    limit v_limit
    offset v_offset
  )
  -- Aggregates run after the page is cut, so they cost v_limit lateral scans
  -- rather than one per archived row.
  select
    c.id,
    c.workspace_id,
    c.name,
    p.display_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.status,
    c.source,
    c.tags,
    c.owner_id,
    c.last_seen_at,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    coalesce(ch.types, array[]::text[]),
    coalesce(cv.conversation_count, 0),
    p.match_total
  from page p
  join public.contacts c on c.id = p.contact_id
  left join lateral (
    select array_agg(distinct cc.channel_type order by cc.channel_type) as types
    from public.contact_channels cc
    where cc.contact_id = c.id
      and cc.workspace_id = c.workspace_id
  ) ch on true
  left join lateral (
    -- What restoring will bring back, so the row can say so.
    select count(*) as conversation_count
    from public.conversations cv2
    where cv2.contact_id = c.id
      and cv2.workspace_id = c.workspace_id
  ) cv on true
  order by p.sort_rank;
end;
$$;

comment on function public.list_archived_contacts(uuid, text, integer, integer) is
  'One page of a workspace''s archived contacts, newest archive first, for the directory''s Archived filter. SECURITY DEFINER so it can read rows the contacts SELECT policy hides from everyone; guarded to owner/admin, which is the authority the dropped DELETE policies used to carry.';

revoke all on function public.list_archived_contacts(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_archived_contacts(uuid, text, integer, integer)
  to authenticated;

commit;
