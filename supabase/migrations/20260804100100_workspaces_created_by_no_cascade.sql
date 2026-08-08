begin;

-- workspaces_created_by_fkey was ON DELETE CASCADE from auth.users. Deleting one
-- account therefore deleted every workspace that account had created, and through
-- the cascades hanging off workspaces it took the channels, contacts,
-- conversations, messages, attachments and notes with them. Workspaces are
-- shared: the other members had no relationship to the deleted account at all,
-- and nothing in the product warned that removing one user erases a team's CRM.
--
-- SET NULL, not RESTRICT.
--
-- RESTRICT keeps the column honest but makes the creator's auth row undeletable
-- for as long as the workspace exists. The workspace belongs to its members, not
-- to whoever typed the name first, so an erasure request or a dashboard delete
-- would fail with no in-product remedy short of destroying other people's data
-- to free the account -- the same outcome the cascade produced, just reached by
-- hand. SET NULL keeps the workspace and its remaining members intact and treats
-- created_by as what it actually is: a historical attribution that can expire.
--
-- Making the column nullable is safe against everything that reads it:
--
--   * handle_new_workspace() inserted workspace_members.user_id = NEW.created_by,
--     and that column is NOT NULL. Guarded below.
--   * one_main_workspace_per_user is UNIQUE (created_by) WHERE is_main = true.
--     NULLs are distinct, so several creatorless main workspaces coexist.
--   * "Users can create workspaces" is WITH CHECK (created_by = auth.uid()),
--     which NULL never satisfies -- the browser still cannot insert one, and the
--     column default is still auth.uid().
--   * "Workspace creators can create owner membership" and the creator branch of
--     "Workspace members can view active workspaces" compare created_by to
--     auth.uid(); a null simply stops matching, leaving the membership branch,
--     which is the access those rows were always meant to have.
--   * complete_onboarding() always supplies auth.uid() explicitly, and its
--     unique_violation fallback looks up `created_by = v_user_id`, which a null
--     row cannot satisfy -- correct, since it is no longer that user's workspace.
--
-- A workspace whose creator is deleted keeps its remaining members: their
-- workspace_members rows are unaffected, only the deleted user's own membership
-- cascades away. A single-member workspace becomes memberless and unreachable,
-- which is the intended outcome of deleting its only user.

alter table public.workspaces
  alter column created_by drop not null;

alter table public.workspaces
  drop constraint workspaces_created_by_fkey;

alter table public.workspaces
  add constraint workspaces_created_by_fkey
  foreign key (created_by) references auth.users (id)
  on delete set null;

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- created_by is nullable now. Only a service-role or SQL-side insert can leave
  -- it null (the RLS insert policy requires created_by = auth.uid()), and there
  -- is no owner to seat in that case, so skip rather than fail the insert on
  -- workspace_members.user_id being NOT NULL.
  if new.created_by is null then
    return new;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  return new;
end;
$$;

commit;
