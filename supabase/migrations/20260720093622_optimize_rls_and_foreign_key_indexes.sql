-- Let Postgres cache auth.uid() as an initPlan for each RLS expression instead
-- of re-evaluating it for every candidate row.

alter policy "Users can create workspaces"
on public.workspaces
with check (created_by = (select auth.uid()));

alter policy "Workspace admins can update active workspaces"
on public.workspaces
using (
  deleted_at is null
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
);

alter policy "Users can view own workspace memberships"
on public.workspace_members
using (user_id = (select auth.uid()));

alter policy "Workspace creators can create owner membership"
on public.workspace_members
with check (
  user_id = (select auth.uid())
  and role = 'owner'::text
  and exists (
    select 1
    from public.workspaces w
    where w.id = workspace_members.workspace_id
      and w.created_by = (select auth.uid())
  )
);

alter policy "Workspace admins can delete contacts"
on public.contacts
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = contacts.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
);

alter policy "Workspace admins can delete conversations"
on public.conversations
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = conversations.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
);

alter policy "Workspace admins can delete messages"
on public.messages
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = messages.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
);

alter policy "Workspace members can create outbound messages as themselves"
on public.messages
with check (
  public.is_workspace_member(workspace_id)
  and direction = 'outbound'::text
  and sender_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.workspace_id = messages.workspace_id
  )
);

alter policy "Workspace members can update workspace messages"
on public.messages
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and c.workspace_id = messages.workspace_id
  )
  and (
    direction = 'inbound'::text
    or sender_id = (select auth.uid())
  )
);

alter policy "Workspace admins can delete contact channels"
on public.contact_channels
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = contact_channels.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
);

alter policy "Users can insert own profile"
on public.profiles
with check (id = (select auth.uid()));

alter policy "Users can update own profile"
on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter policy "Users can view own profile"
on public.profiles
using (id = (select auth.uid()));

alter policy "Workspace members can read chat media objects"
on storage.objects
using (
  bucket_id = 'chat-media'::text
  and case
    when split_part(name, '/'::text, 1)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text
    then exists (
      select 1
      from public.workspace_members wm
      where wm.user_id = (select auth.uid())
        and wm.workspace_id = split_part(objects.name, '/'::text, 1)::uuid
    )
    else false
  end
);

alter policy "Workspace members can upload chat media"
on storage.objects
with check (
  bucket_id = 'chat-media'::text
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = (storage.foldername(objects.name))[1]::uuid
      and wm.user_id = (select auth.uid())
  )
);

alter policy "Workspace members can update chat media"
on storage.objects
using (
  bucket_id = 'chat-media'::text
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = (storage.foldername(objects.name))[1]::uuid
      and wm.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'chat-media'::text
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = (storage.foldername(objects.name))[1]::uuid
      and wm.user_id = (select auth.uid())
  )
);

alter policy "Workspace members can delete chat media"
on storage.objects
using (
  bucket_id = 'chat-media'::text
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = (storage.foldername(objects.name))[1]::uuid
      and wm.user_id = (select auth.uid())
  )
);

-- For advisor coverage, each foreign-key column needs a non-partial index as
-- the leading key. Existing composite indexes remain intact for their queries.

create index contact_channels_contact_id_fkey_idx
on public.contact_channels using btree (contact_id);

create index conversation_reads_user_id_fkey_idx
on public.conversation_reads using btree (user_id);

create index conversations_assigned_to_fkey_idx
on public.conversations using btree (assigned_to);

create index conversations_channel_id_fkey_idx
on public.conversations using btree (channel_id);

create index messages_sender_id_fkey_idx
on public.messages using btree (sender_id);

create index workspace_members_invited_by_fkey_idx
on public.workspace_members using btree (invited_by);

create index workspaces_updated_by_fkey_idx
on public.workspaces using btree (updated_by);
