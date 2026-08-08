begin;

-- set_workspace_phone_region() could never write. It runs SECURITY INVOKER, and
-- authenticated's update grant on public.workspaces is the column list
-- (name, description, icon) from 20260720090850 -- default_phone_region was
-- added later, by 20260803120000, and never granted. Every call raised
-- "permission denied for table workspaces" from inside the function, so the
-- workspace phone region could not be set from the browser at all and every
-- unqualified number stayed ambiguous. contact_phone_identity.test.sql has been
-- failing on it.
--
-- Definer rights rather than a new column grant: the function already performs
-- the owner/admin check itself against workspace_members, and it is the only
-- intended writer. Granting update(default_phone_region) to authenticated would
-- open the column to any direct PostgREST write that satisfies the workspaces
-- update policy, which is a wider surface than the RPC it exists to serve.
--
-- Because definer rights bypass the "Workspace admins can update active
-- workspaces" policy, the two conditions that policy contributed are restated:
-- the role check was already here, and deleted_at is null is added below.

create or replace function public.set_workspace_phone_region(
  p_workspace_id uuid,
  p_region text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_region text := nullif(btrim(upper(coalesce(p_region, ''))), '');
begin
  if v_region is not null and v_region !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_PHONE_REGION' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN' using errcode = '42501';
  end if;

  update public.workspaces w
  set default_phone_region = v_region
  where w.id = p_workspace_id
    and w.deleted_at is null;

  return v_region;
end;
$$;

comment on function public.set_workspace_phone_region(uuid, text) is
  'Sets the workspace default phone region (ISO alpha-2, or NULL to clear). Owners and admins only. SECURITY DEFINER: the column is deliberately not in authenticated''s update grant, so this RPC is the only write path.';

commit;
