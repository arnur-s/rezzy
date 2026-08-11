begin;

-- soft_delete_workspace is REVOKEd from PUBLIC and granted to no role, and
-- supabase/tests/database/workspace_lifecycle.test.sql records that as
-- deliberate. It nonetheless appeared in src/api/types.ts as a callable RPC,
-- because that file is generated from whatever the Data API exposes -- so the
-- client surface advertised an operation the database refuses.
--
-- Moving it out of public is what removes it from generation. It stays callable
-- at the owning role, exactly as today, and its ownership check is unchanged.
-- Deleting a workspace remains unreachable from the browser until someone
-- deliberately builds it.

alter function public.soft_delete_workspace(uuid) set schema private;

commit;
