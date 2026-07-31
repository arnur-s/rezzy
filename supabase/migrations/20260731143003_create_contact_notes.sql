begin;

alter table public.contacts
  add constraint contacts_workspace_id_id_key unique (workspace_id, id);

create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_notes_contact_workspace_fkey
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id)
    on delete cascade,
  constraint contact_notes_body_length_check
    check (char_length(btrim(body)) between 1 and 5000)
);

create index contact_notes_contact_order_idx
  on public.contact_notes (
    workspace_id,
    contact_id,
    is_pinned desc,
    updated_at desc,
    created_at desc,
    id desc
  );

create index contact_notes_author_id_idx
  on public.contact_notes(author_id);

-- Preserve nonblank values from the legacy single-note field without inventing
-- an author. New browser-created notes receive trusted attribution below.
insert into public.contact_notes (
  workspace_id,
  contact_id,
  author_id,
  author_name,
  body,
  is_pinned,
  created_at,
  updated_at
)
select
  c.workspace_id,
  c.id,
  null,
  null,
  btrim(c.notes),
  false,
  c.created_at,
  c.updated_at
from public.contacts c
where nullif(btrim(c.notes), '') is not null;

create or replace function public.enforce_contact_note_integrity()
returns trigger
language plpgsql
security invoker
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

drop trigger if exists contact_notes_integrity on public.contact_notes;
create trigger contact_notes_integrity
  before insert or update on public.contact_notes
  for each row execute function public.enforce_contact_note_integrity();

drop trigger if exists contact_notes_updated_at on public.contact_notes;
create trigger contact_notes_updated_at
  before update on public.contact_notes
  for each row execute function public.handle_updated_at();

alter table public.contact_notes enable row level security;

revoke all privileges on table public.contact_notes
from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.contact_notes
to authenticated;

grant select, insert, update, delete on table public.contact_notes
to service_role;

create policy "Workspace members can view contact notes"
  on public.contact_notes
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create contact notes"
  on public.contact_notes
  for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and author_id = (select auth.uid())
    and exists (
      select 1
      from public.contacts c
      where c.workspace_id = contact_notes.workspace_id
        and c.id = contact_notes.contact_id
    )
  );

create policy "Workspace members can update contact note pins and own content"
  on public.contact_notes
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1
      from public.contacts c
      where c.workspace_id = contact_notes.workspace_id
        and c.id = contact_notes.contact_id
    )
  );

create policy "Authors and workspace admins can delete contact notes"
  on public.contact_notes
  for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = contact_notes.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role = any (array['owner'::text, 'admin'::text])
    )
  );

commit;
