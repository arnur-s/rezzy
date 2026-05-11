-- Adds row level security policies for workspace-scoped tables
-- (channels, contacts, contact_channels, conversations, messages).
--
-- Access pattern: a row is visible / mutable to an authenticated user when
-- they are a member of the row's workspace, determined via the existing
-- public.is_workspace_member(p_workspace_id) helper.

alter table public.channels enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.contact_channels to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

-- channels --------------------------------------------------------------------

drop policy if exists "Workspace members can view channels" on public.channels;
create policy "Workspace members can view channels"
  on public.channels
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create channels" on public.channels;
create policy "Workspace members can create channels"
  on public.channels
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update channels" on public.channels;
create policy "Workspace members can update channels"
  on public.channels
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete channels" on public.channels;
create policy "Workspace members can delete channels"
  on public.channels
  for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- contacts --------------------------------------------------------------------

drop policy if exists "Workspace members can view contacts" on public.contacts;
create policy "Workspace members can view contacts"
  on public.contacts
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create contacts" on public.contacts;
create policy "Workspace members can create contacts"
  on public.contacts
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update contacts" on public.contacts;
create policy "Workspace members can update contacts"
  on public.contacts
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete contacts" on public.contacts;
create policy "Workspace members can delete contacts"
  on public.contacts
  for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- contact_channels (workspace inferred via parent contact) --------------------

drop policy if exists "Workspace members can view contact channels" on public.contact_channels;
create policy "Workspace members can view contact channels"
  on public.contact_channels
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists "Workspace members can create contact channels" on public.contact_channels;
create policy "Workspace members can create contact channels"
  on public.contact_channels
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists "Workspace members can update contact channels" on public.contact_channels;
create policy "Workspace members can update contact channels"
  on public.contact_channels
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

drop policy if exists "Workspace members can delete contact channels" on public.contact_channels;
create policy "Workspace members can delete contact channels"
  on public.contact_channels
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.contacts c
      where c.id = contact_channels.contact_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

-- conversations ---------------------------------------------------------------

drop policy if exists "Workspace members can view conversations" on public.conversations;
create policy "Workspace members can view conversations"
  on public.conversations
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create conversations" on public.conversations;
create policy "Workspace members can create conversations"
  on public.conversations
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update conversations" on public.conversations;
create policy "Workspace members can update conversations"
  on public.conversations
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete conversations" on public.conversations;
create policy "Workspace members can delete conversations"
  on public.conversations
  for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- messages --------------------------------------------------------------------

drop policy if exists "Workspace members can view messages" on public.messages;
create policy "Workspace members can view messages"
  on public.messages
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create messages" on public.messages;
create policy "Workspace members can create messages"
  on public.messages
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update messages" on public.messages;
create policy "Workspace members can update messages"
  on public.messages
  for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Workspace members can delete messages" on public.messages;
create policy "Workspace members can delete messages"
  on public.messages
  for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
