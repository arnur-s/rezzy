begin;

-- One request owns the contact fields and its optional complete phone set.
-- SECURITY INVOKER preserves the existing column grants, owner guard and RLS;
-- errors in either write roll back both, including a newly inserted contact.
create or replace function public.save_contact(
  p_workspace_id uuid,
  p_fields jsonb,
  p_contact_id uuid default null,
  p_phones text[] default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contact_id uuid;
  v_result jsonb;
  v_tags text[];
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception 'INVALID_CONTACT_FIELDS' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_fields) k
    where k not in ('name', 'phone', 'email', 'status', 'tags', 'owner_id')
  ) then
    raise exception 'INVALID_CONTACT_FIELDS' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(p_fields) f
    where f.key <> 'tags' and jsonb_typeof(f.value) not in ('string', 'null')
  ) or (p_fields ? 'status' and jsonb_typeof(p_fields -> 'status') <> 'string') then
    raise exception 'INVALID_CONTACT_FIELDS' using errcode = '22023';
  end if;

  if p_fields ? 'tags' then
    if jsonb_typeof(p_fields -> 'tags') <> 'array' then
      raise exception 'INVALID_CONTACT_FIELDS' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_fields -> 'tags') value
      where jsonb_typeof(value) <> 'string'
    ) then
      raise exception 'INVALID_CONTACT_FIELDS' using errcode = '22023';
    end if;
    select coalesce(array_agg(value), array[]::text[]) into v_tags
    from jsonb_array_elements_text(p_fields -> 'tags');
  end if;

  if p_contact_id is null then
    insert into public.contacts (workspace_id, name, phone, email, status, tags, owner_id, source)
    values (
      p_workspace_id, p_fields ->> 'name', p_fields ->> 'phone', p_fields ->> 'email',
      coalesce(p_fields ->> 'status', 'new'), coalesce(v_tags, array[]::text[]),
      (p_fields ->> 'owner_id')::uuid, 'manual'
    )
    returning id into v_contact_id;
  else
    update public.contacts c
    set name = case when p_fields ? 'name' then p_fields ->> 'name' else c.name end,
        phone = case when p_fields ? 'phone' then p_fields ->> 'phone' else c.phone end,
        email = case when p_fields ? 'email' then p_fields ->> 'email' else c.email end,
        status = case when p_fields ? 'status' then p_fields ->> 'status' else c.status end,
        tags = case when p_fields ? 'tags' then v_tags else c.tags end,
        owner_id = case when p_fields ? 'owner_id' then (p_fields ->> 'owner_id')::uuid else c.owner_id end
    where c.id = p_contact_id
      and c.workspace_id = p_workspace_id
    returning c.id into v_contact_id;

    if not found then
      raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  if p_phones is not null then
    perform public.set_contact_phones(p_workspace_id, v_contact_id, p_phones);
  end if;

  select to_jsonb(c) || jsonb_build_object('contact_channels', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cc.id, 'channel_type', cc.channel_type, 'external_id', cc.external_id,
      'external_name', cc.external_name, 'channel_id', cc.channel_id
    ) order by cc.created_at, cc.id)
    from public.contact_channels cc
    where cc.contact_id = c.id and cc.workspace_id = c.workspace_id
  ), '[]'::jsonb))
  into v_result
  from public.contacts c
  where c.id = v_contact_id and c.workspace_id = p_workspace_id;

  return v_result;
end;
$$;

revoke all on function public.save_contact(uuid, jsonb, uuid, text[])
  from public, anon, authenticated, service_role;
grant execute on function public.save_contact(uuid, jsonb, uuid, text[])
  to authenticated;

comment on function public.save_contact(uuid, jsonb, uuid, text[]) is
  'Atomically creates or updates a live contact and optionally replaces its whole phone set. Returns the saved contact with channel summaries in the same transaction. Invoker rights preserve workspace RLS and column grants.';

commit;
