begin;

-- The phone table is a complete set, not an append operation. Serialize on the
-- parent before reading/deleting children: otherwise two writers can both delete
-- the old set, insert disjoint new rows, and leave the union of both requests.
-- The parent lock also serializes with archive and merge, and RLS prevents an
-- archived or inaccessible contact from losing children through this RPC.
create or replace function public.set_contact_phones(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_phones text[]
)
returns table (id uuid, phone text, digits text, "position" integer)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_phones text[];
begin
  perform 1
  from public.contacts c
  where c.workspace_id = p_workspace_id
    and c.id = p_contact_id
    and c.deleted_at is null
    and c.merged_into_id is null
  for update;

  if not found then
    raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  with cleaned as (
    select btrim(raw.value) as value, raw.ordinality as rank
    from unnest(coalesce(p_phones, array[]::text[]))
      with ordinality as raw(value, ordinality)
    where nullif(btrim(raw.value), '') is not null
      and char_length(public.phone_digits(raw.value)) >= 5
      and char_length(btrim(raw.value)) between 3 and 32
  ),
  deduped as (
    select
      (array_agg(cleaned.value order by cleaned.rank))[1] as value,
      min(cleaned.rank) as rank
    from cleaned
    group by public.phone_digits(cleaned.value)
  ),
  capped as (
    select deduped.value, deduped.rank
    from deduped
    order by deduped.rank
    limit 10
  )
  select coalesce(array_agg(capped.value order by capped.rank), array[]::text[])
  into v_phones
  from capped;

  delete from public.contact_phones cp
  where cp.workspace_id = p_workspace_id
    and cp.contact_id = p_contact_id
    and not exists (
      select 1
      from unnest(v_phones) as kept(value)
      where public.phone_digits(kept.value) = cp.digits
    );

  insert into public.contact_phones (workspace_id, contact_id, phone, position)
  select p_workspace_id, p_contact_id, entry.value, entry.ordinality - 1
  from unnest(v_phones) with ordinality as entry(value, ordinality)
  on conflict (contact_id, digits) do update
    set phone = excluded.phone,
        position = excluded.position;

  update public.contacts c
  set phone = v_phones[1]
  where c.workspace_id = p_workspace_id
    and c.id = p_contact_id
    and c.phone is distinct from v_phones[1];

  return query
  select cp.id, cp.phone, cp.digits, cp.position
  from public.contact_phones cp
  where cp.workspace_id = p_workspace_id
    and cp.contact_id = p_contact_id
  order by cp.position, cp.created_at, cp.id;
end;
$$;

comment on function public.set_contact_phones(uuid, uuid, text[]) is
  'Replaces one live contact''s entire phone set and syncs its primary number, serialized by a parent row lock. SECURITY INVOKER: RLS is the boundary; missing, archived and inaccessible contacts all raise CONTACT_NOT_FOUND.';

commit;
