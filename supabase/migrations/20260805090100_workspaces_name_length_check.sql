begin;

-- complete_onboarding() validates the workspace name at 2-60 characters on the
-- trimmed value, but that guard only covers the onboarding path. authenticated
-- also holds insert("name") and update("name") column grants on the table, and
-- the create/rename workspace forms use them directly
-- (src/features/workspaces/api/workspaces.ts), so a workspace could be created
-- named '' or ' ' -- unclickable in the sidebar and indistinguishable from its
-- neighbours in the switcher -- or with a name long enough to break every
-- fixed-width control that renders it.
--
-- The check is on btrim(name), matching what the RPC validates and what both
-- client paths send (name.trim()). Leading and trailing whitespace is still
-- storable; a name that is *only* whitespace is not.
--
-- Existing rows first: the constraint is added validated, so a violating row
-- would fail the migration in the middle of a deploy. Fail deliberately, with
-- the count, instead.

do $$
declare
  violating_rows int;
begin
  select count(*)
  into violating_rows
  from public.workspaces
  where char_length(btrim(name)) < 2
     or char_length(btrim(name)) > 60;

  if violating_rows > 0 then
    raise exception
      'workspaces has % row(s) whose trimmed name is outside 2-60 characters; rename them before migrating',
      violating_rows;
  end if;
end $$;

alter table public.workspaces
  add constraint workspaces_name_length_check
    check (char_length(btrim(name)) between 2 and 60);

commit;
