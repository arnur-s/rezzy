begin;

create or replace function public.handle_contact_note_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_contact_note_updated_at()
from public, anon, authenticated, service_role;

drop trigger if exists contact_notes_updated_at on public.contact_notes;
create trigger contact_notes_updated_at
  before update on public.contact_notes
  for each row execute function public.handle_contact_note_updated_at();

drop policy if exists "Authors and workspace admins can delete contact notes"
on public.contact_notes;

create policy "Authors and workspace admins can delete contact notes"
  on public.contact_notes
  for delete
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (
      author_id = (select auth.uid())
      or exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = contact_notes.workspace_id
          and wm.user_id = (select auth.uid())
          and wm.role = any (array['owner'::text, 'admin'::text])
      )
    )
  );

commit;
