begin;

-- Creating a workspace from the browser failed with 42501 even though the
-- insert policy passed.
--
-- The client inserts with a RETURNING clause (`.insert(...).select()`), and for
-- `insert ... returning` PostgreSQL applies the SELECT policies as an extra
-- WITH CHECK on the new row. That check runs in ExecInsert *before* AFTER ROW
-- triggers fire, so public.handle_new_workspace() has not created the owner
-- membership yet. A membership-only select policy therefore cannot see the row
-- its own creator just inserted, and every browser create was rejected.
--
-- The creator predicate below is what 20260508000000_create_auth_workspace_flow
-- shipped as "Workspace creators and members can view workspaces";
-- 20260515130754_remote_schema dropped it as part of a dump diff. Restoring it
-- closes the gap. It is listed first so it short-circuits the membership
-- subquery for rows the caller created.
--
-- Trade-off: a creator who is removed from workspace_members keeps read access
-- to the workspace row itself (name, description, icon). Nothing else follows,
-- because every child table is gated on public.is_workspace_member, and there
-- is no client-reachable path that removes a membership today.

drop policy if exists "Workspace members can view active workspaces"
on public.workspaces;

create policy "Workspace members can view active workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    deleted_at is null
    and (
      created_by = (select auth.uid())
      or public.is_workspace_member(id)
    )
  );

commit;
