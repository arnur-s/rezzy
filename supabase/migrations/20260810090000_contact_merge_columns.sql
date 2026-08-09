-- Contact merge, part 1 of 3: the columns a merge leaves behind, and the two
-- existing functions that have to learn about them.
--
-- There is no merge-log table. The merged contact's row survives soft-deleted
-- with every scalar field untouched, so "what did this contact look like before"
-- is answered by reading it. merged_into_id records where it went; merged_at and
-- merged_by record when and by whom. Three columns replace a table whose only
-- other job would have been feeding an unmerge that this feature does not have.

begin;

alter table public.contacts
  add column merged_into_id uuid,
  add column merged_at      timestamptz,
  add column merged_by      uuid references public.profiles(id) on delete set null;

-- Composite, against the (workspace_id, id) unique key added in
-- 20260731143003: a merge must not be able to point across a workspace.
alter table public.contacts
  add constraint contacts_merged_into_fkey
  foreign key (workspace_id, merged_into_id)
  references public.contacts(workspace_id, id);

-- A merged contact is archived, always. Nothing may leave one live: the
-- directory has no way to render a contact whose children belong to someone
-- else, and every read path that hides archived rows would otherwise show it.
alter table public.contacts
  add constraint contacts_merged_is_archived_check
  check (merged_into_id is null or deleted_at is not null);

-- Partial: the overwhelming majority of contacts are never merged.
create index contacts_merged_into_idx
  on public.contacts (workspace_id, merged_into_id)
  where merged_into_id is not null;

comment on column public.contacts.merged_into_id is
  'The surviving contact this one was merged into, or NULL. Always accompanied by deleted_at. Never chains: merge_contacts refuses a contact that already carries one, so this points at a contact that has not itself been merged.';


-- =========================================================
-- restore_contact: refuse a merged contact
-- =========================================================
--
-- Without this, restoring a merged contact writes merged_into_id onto a row with
-- deleted_at null and fails the check constraint above with a raw 23514. It
-- would also be pointless: a restored merge-shell is a contact with no
-- conversations, notes, channels or phones, because they all belong to the
-- survivor now.
--
-- CREATE OR REPLACE preserves the grants from 20260808090100.
--
-- The admin check keeps the join to workspaces and the w.deleted_at is null
-- predicate that 20260809120000 added: that migration closed archive_contact
-- and restore_contact as two of the paths that let a caller keep acting on a
-- soft-deleted workspace after membership rows survived its deletion. Dropping
-- that join here would silently reopen restore_contact to the same containment
-- gap for the sake of the merge guard below, which is unrelated to it.

create or replace function public.restore_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_merged_into uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  select c.workspace_id, c.merged_into_id
  into v_workspace_id, v_merged_into
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

  -- After the authority check, not before: "this contact was merged" is
  -- information, and a non-admin should not learn it from the error they get.
  if v_merged_into is not null then
    raise exception 'CONTACT_IS_MERGED'
      using errcode = 'P0001';
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
  'Clears public.contacts.deleted_at and, through trg_cascade_contact_archive, that of its conversations. Owner/admin only. Refuses a merged contact: its children belong to the survivor, so restoring it would produce an empty shell and violate contacts_merged_is_archived_check.';


-- =========================================================
-- list_archived_contacts: say which rows are merged
-- =========================================================
--
-- The archived view has to tell a merged row from an archived one: the first
-- gets "merged into X" and no Restore button, the second keeps the button it has
-- today. Two trailing columns rather than a second RPC.
--
-- The parameter signature is unchanged, but the RETURNS TABLE shape is not --
-- and changing a function's return type is not something CREATE OR REPLACE can
-- do; Postgres requires a DROP first (see 20260731183000 for the same situation
-- with list_workspace_members). The two new columns go at the END of the
-- RETURNS TABLE; adding them in the middle would silently re-map every existing
-- column for any caller reading positionally. The DROP loses the grants
-- 20260808090100 set, so they are restated below in full rather than assumed
-- preserved.

drop function if exists public.list_archived_contacts(uuid, text, integer, integer);

create function public.list_archived_contacts(
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
  total_count bigint,
  merged_into_id uuid,
  merged_into_name text
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
    p.match_total,
    c.merged_into_id,
    sv.display_name
  from page p
  join public.contacts c on c.id = p.contact_id
  left join lateral (
    select array_agg(distinct cc.channel_type order by cc.channel_type) as types
    from public.contact_channels cc
    where cc.contact_id = c.id
      and cc.workspace_id = c.workspace_id
  ) ch on true
  left join lateral (
    select count(*) as conversation_count
    from public.conversations cv2
    where cv2.contact_id = c.id
      and cv2.workspace_id = c.workspace_id
  ) cv on true
  -- The survivor's name, computed the same way, so the row can name it without
  -- a second request. Null when the row was archived rather than merged.
  left join lateral (
    select coalesce(
      nullif(btrim(s.name), ''),
      (
        select nullif(btrim(cc.external_name), '')
        from public.contact_channels cc
        where cc.contact_id = s.id
          and cc.workspace_id = s.workspace_id
          and nullif(btrim(cc.external_name), '') is not null
        order by cc.created_at asc, cc.id asc
        limit 1
      )
    ) as display_name
    from public.contacts s
    where s.id = c.merged_into_id
      and s.workspace_id = c.workspace_id
  ) sv on true
  order by p.sort_rank;
end;
$$;

comment on function public.list_archived_contacts(uuid, text, integer, integer) is
  'One page of a workspace''s archived contacts, newest archive first, for the directory''s Archived filter. SECURITY DEFINER so it can read rows the contacts SELECT policy hides; guarded to owner/admin. merged_into_id and merged_into_name are non-null for rows that were merged rather than archived; those rows are not restorable.';

-- Restated from 20260808090100: the DROP above did not carry these forward.
revoke all on function public.list_archived_contacts(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_archived_contacts(uuid, text, integer, integer)
  to authenticated;

commit;
