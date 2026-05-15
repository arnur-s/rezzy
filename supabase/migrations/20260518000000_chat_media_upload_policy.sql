-- Allow authenticated workspace members to upload, update, and delete
-- chat media objects. The SELECT policy already exists from the previous
-- migration. Path convention: {workspaceId}/{conversationId}/{uuid}/{filename}

create policy "Workspace members can upload chat media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = (storage.foldername(name))[1]::uuid
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can update chat media"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = (storage.foldername(name))[1]::uuid
        and wm.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = (storage.foldername(name))[1]::uuid
        and wm.user_id = auth.uid()
    )
  );

create policy "Workspace members can delete chat media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = (storage.foldername(name))[1]::uuid
        and wm.user_id = auth.uid()
    )
  );
