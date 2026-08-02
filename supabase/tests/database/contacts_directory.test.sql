begin;

select plan(33);

-- Contract for the contacts directory: contacts.owner_id and its membership
-- guard, the retirement of contacts.notes, and the two RPCs the directory reads
-- through (public.search_workspace_contacts, public.list_workspace_members).
--
-- Fixture numbering deliberately avoids contact_notes.test.sql's range:
--   users  …01{11,12,13}   workspaces …02{11,12}   channels …04{11}
--   contacts …03{11..15}

-- ── Shape ─────────────────────────────────────────────────────────────────────
select has_column('public', 'contacts', 'owner_id', 'contacts has owner_id');
select col_is_null('public', 'contacts', 'owner_id', 'a contact may be unowned');
select hasnt_column(
  'public', 'contacts', 'notes',
  'the legacy single-note column is gone now that contact_notes owns notes'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contacts'::regclass
      and contype = 'f'
      and confrelid = 'public.profiles'::regclass
      and confdeltype = 'n'
      and conkey = array[(
        select attnum from pg_attribute
        where attrelid = 'public.contacts'::regclass and attname = 'owner_id'
      )]::smallint[]
  ),
  'owner_id references profiles and is cleared, not cascaded, when a profile goes'
);

select has_index('public', 'contacts', 'contacts_owner_id_fkey_idx',
  'owner_id has a covering index for the FK and the owner facet');
select has_index('public', 'contacts', 'contacts_search_trgm_idx',
  'name/email/phone share one trigram index');
select has_index('public', 'contact_channels', 'contact_channels_external_name_trgm_idx',
  'channel handles are trigram indexed');

select ok(
  exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm' and n.nspname = 'extensions'
  ),
  'pg_trgm lives in extensions, off the Data API surface'
);

-- ── Security metadata ─────────────────────────────────────────────────────────
select ok(
  (select not prosecdef from pg_proc where proname = 'search_workspace_contacts'),
  'search_workspace_contacts is security invoker so contacts RLS stays the boundary'
);
select ok(
  (select prosecdef from pg_proc where proname = 'list_workspace_members'),
  'list_workspace_members is security definer so it can out-reach own-row RLS'
);
select ok(
  (select prosecdef from pg_proc where proname = 'ensure_contact_owner_is_workspace_member'),
  'the owner guard is security definer, or own-row RLS would hide every co-worker'
);
select ok(
  (
    select bool_and(proconfig @> array['search_path=""'])
    from pg_proc
    where proname in (
      'search_workspace_contacts',
      'list_workspace_members',
      'ensure_contact_owner_is_workspace_member'
    )
  ),
  'every new function pins an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.list_workspace_members(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)', 'execute'),
  'anon cannot execute either directory RPC'
);
select ok(
  has_function_privilege('authenticated', 'public.list_workspace_members(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.search_workspace_contacts(uuid,text,text[],text[],text[],uuid[],boolean,text,integer,integer)', 'execute'),
  'authenticated can execute both directory RPCs'
);
select has_trigger('public', 'contacts', 'trg_ensure_contact_owner_is_workspace_member',
  'contacts carries the owner membership guard');

-- ── Fixtures ──────────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at, raw_user_meta_data)
values
  ('20000000-0000-4000-8000-000000000111','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','dir.member@example.com','x',now(),now(),now(),
   '{"full_name":"Dir Member"}'),
  ('20000000-0000-4000-8000-000000000112','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','dir.mate@example.com','x',now(),now(),now(),
   '{"full_name":"Dir Mate"}'),
  ('20000000-0000-4000-8000-000000000113','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','dir.outsider@example.com','x',now(),now(),now(),
   '{"full_name":"Dir Outsider"}');

-- Creating a workspace enrols its creator, so only the co-worker is added by hand.
insert into public.workspaces (id, name, created_by) values
  ('20000000-0000-4000-8000-000000000211','Directory WS','20000000-0000-4000-8000-000000000111'),
  ('20000000-0000-4000-8000-000000000212','Other WS','20000000-0000-4000-8000-000000000113');
insert into public.workspace_members (workspace_id, user_id, role)
values ('20000000-0000-4000-8000-000000000211','20000000-0000-4000-8000-000000000112','member');

insert into public.channels (id, workspace_id, type, name)
values ('20000000-0000-4000-8000-000000000411','20000000-0000-4000-8000-000000000211','telegram','TG');

insert into public.contacts (id, workspace_id, name, status, tags) values
  ('20000000-0000-4000-8000-000000000311','20000000-0000-4000-8000-000000000211','Zed Last','new','{vip,ru}'),
  ('20000000-0000-4000-8000-000000000312','20000000-0000-4000-8000-000000000211','Alpha First','in_progress','{vip}'),
  ('20000000-0000-4000-8000-000000000313','20000000-0000-4000-8000-000000000211',null,'new','{}'),
  ('20000000-0000-4000-8000-000000000314','20000000-0000-4000-8000-000000000211','Discount 50% Co','new','{}'),
  ('20000000-0000-4000-8000-000000000315','20000000-0000-4000-8000-000000000212','Other Workspace Person','new','{}');

-- A contact reachable only by its Telegram handle: no name at all.
insert into public.contact_channels (contact_id, workspace_id, channel_id, channel_type,
                                     external_id, external_name)
values ('20000000-0000-4000-8000-000000000313','20000000-0000-4000-8000-000000000211',
        '20000000-0000-4000-8000-000000000411','telegram','tg-1','bravo_tg');

-- ── Owner guard ───────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000111","role":"authenticated"}';

-- The assertion that fails if this guard is ever "simplified" to security
-- invoker: own-row RLS on workspace_members hides the co-worker's row from the
-- caller, so an invoker-rights EXISTS would reject a perfectly valid teammate.
select lives_ok(
  $$
    update public.contacts
    set owner_id = '20000000-0000-4000-8000-000000000112'
    where id = '20000000-0000-4000-8000-000000000311'
  $$,
  'a member can hand a contact to a co-worker they cannot see in workspace_members'
);

select is(
  (select owner_id from public.contacts where id = '20000000-0000-4000-8000-000000000311'),
  '20000000-0000-4000-8000-000000000112'::uuid,
  'the owner is persisted'
);

select throws_ok(
  $$
    update public.contacts
    set owner_id = '20000000-0000-4000-8000-000000000113'
    where id = '20000000-0000-4000-8000-000000000311'
  $$,
  '23503', 'CONTACT_OWNER_NOT_WORKSPACE_MEMBER',
  'a contact cannot be handed to somebody outside its workspace'
);

select throws_ok(
  $$
    insert into public.contacts (workspace_id, name, owner_id)
    values ('20000000-0000-4000-8000-000000000211','New Person',
            '20000000-0000-4000-8000-000000000113')
  $$,
  '23503', 'CONTACT_OWNER_NOT_WORKSPACE_MEMBER',
  'the guard runs on insert as well as update'
);

-- ── Search RPC ────────────────────────────────────────────────────────────────
select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211')),
  4,
  'search returns only the caller workspace, never the other workspace contact'
);

select is(
  (select max(total_count)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_limit := 1)),
  4,
  'total_count is the full match count even when a single row is requested'
);

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_limit := 1)),
  1,
  'the page honours p_limit'
);

select is(
  (select id from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_query := 'bravo')),
  '20000000-0000-4000-8000-000000000313'::uuid,
  'free text reaches contact_channels.external_name, so a nameless contact is findable'
);

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_query := '%')),
  1,
  'a bare percent is matched literally rather than as a wildcard'
);

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_tags := '{vip,ru}')),
  1,
  'tag filtering is contains-all: two tags narrow rather than widen'
);

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_statuses := '{in_progress}')),
  1,
  'status filtering is any-of'
);

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211', p_include_unowned := true)),
  3,
  'the unowned facet is expressible separately from an owner id'
);

-- The display-name fallback: the nameless contact must sort under its handle
-- "bravo_tg", between "Alpha First" and "Discount 50% Co", because that is the
-- string the directory prints on its row.
select results_eq(
  $$
    select coalesce(name, '(handle)')
    from public.search_workspace_contacts(
      '20000000-0000-4000-8000-000000000211', p_sort := 'name_asc')
  $$,
  $$ values ('Alpha First'), ('(handle)'), ('Discount 50% Co'), ('Zed Last') $$,
  'name sort orders by the same string the row displays, handle included'
);

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211',
     p_sort := 'name_asc; drop table public.contacts')),
  4,
  'an unrecognised sort degrades to the default instead of raising or injecting'
);

-- ── Roster RPC ────────────────────────────────────────────────────────────────
select results_eq(
  $$
    select full_name from public.list_workspace_members(
      '20000000-0000-4000-8000-000000000211')
  $$,
  $$ values ('Dir Member'), ('Dir Mate') $$,
  'the roster returns co-workers, owner first, which own-row RLS alone cannot do'
);

-- ── Isolation ─────────────────────────────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"20000000-0000-4000-8000-000000000113","role":"authenticated"}';

select is(
  (select count(*)::int from public.search_workspace_contacts(
     '20000000-0000-4000-8000-000000000211')),
  0,
  'naming another workspace explicitly still returns nothing: RLS is the boundary'
);

select throws_ok(
  $$
    select * from public.list_workspace_members(
      '20000000-0000-4000-8000-000000000211')
  $$,
  '42501', 'NOT_A_WORKSPACE_MEMBER',
  'the roster refuses a caller who is not in the workspace'
);

-- The update is silently a no-op rather than an error: RLS filters the rows it
-- can see, so nothing matches. Verified from a role that CAN read the row.
update public.contacts set name = 'Hijacked'
where id = '20000000-0000-4000-8000-000000000311';

reset role;

select is(
  (select name from public.contacts where id = '20000000-0000-4000-8000-000000000311'),
  'Zed Last',
  'an outsider cannot update a contact in a workspace they do not belong to'
);

select * from finish();
rollback;
