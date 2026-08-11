# Merge Contacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an owner/admin collapse two duplicate contacts into one, with duplicates found by exact identity keys and the merge guarded by a two-step destructive confirmation.

**Architecture:** Three new Postgres functions (`merge_contacts`, `list_duplicate_contact_groups`, `count_contact_merge_children`) plus three new columns on `public.contacts`. The merge repoints the four child tables onto a survivor and soft-deletes the loser with `merged_into_id`. The client gains a third directory view for duplicates, a two-step dialog, and a redirect from a merged contact's URL.

**Tech Stack:** Postgres/Supabase (pgTAP for database tests), React 19, TanStack Router + Query, Zod, Astryx (`@astryxdesign/core`), Paraglide/Inlang, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-09-merge-contacts-design.md` — read it first. This plan implements it; where the two disagree, the spec is the intent and the plan is the mechanics.

## Global Constraints

- Read `AGENTS.md` and inspect the current repository before changing anything. The repository is the source of truth.
- Work in the `.claude/worktrees/merge-contacts-spec` worktree, on branch `worktree-merge-contacts-spec`. Do not edit the main checkout.
- **pnpm only.** Do not add a dependency. Everything here uses packages already installed.
- **Never hand-edit** `src/api/types.ts`, `src/paraglide/**`, `src/routeTree.gen.ts`, `src/generated/**`.
- New RPCs are invisible to `supabase.rpc`'s generated overloads until types are regenerated, so call them through `callRpc(name, args, zodSchema)` from `@/utils/supabase-rpc`. That is the established bridge; see `src/features/contacts/api/contact-matches.ts`.
- **All user-facing text goes through Paraglide.** Edit `messages/en.json` and `messages/ru.json`. `baseLocale` is `ru`. No hardcoded English anywhere, including error fallbacks.
- **Counted strings must be plural variants** with `one` / `few` / `many` for Russian. Never branch on a count in TypeScript.
- Every new SQL function: `set search_path = ''`, fully schema-qualified identifiers, then `revoke all on function … from public, anon, authenticated, service_role;` followed by `grant execute … to authenticated;`.
- Do not rewrite existing migrations. Add new ones.
- Local Supabase is shared across worktrees on fixed ports. Do not run `pnpm test:db` or `supabase db reset` concurrently with another worktree.
- Minimum validation per task is stated in that task. `pnpm typecheck` runs `pnpm i18n:compile` for you.
- Commit at the end of every task. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260810090000_contact_merge_columns.sql` | `merged_into_id` / `merged_at` / `merged_by`, constraints, `restore_contact` guard, `list_archived_contacts` extension |
| `supabase/migrations/20260810090100_merge_contacts.sql` | the `merge_contacts` RPC |
| `supabase/migrations/20260810090200_duplicate_contact_groups.sql` | `list_duplicate_contact_groups`, `count_contact_merge_children` |
| `supabase/tests/database/contact_merge.test.sql` | pgTAP for both merge migrations |
| `supabase/tests/database/contact_duplicates.test.sql` | pgTAP for the duplicate finder |
| `src/features/contacts/api/contact-merges.ts` | RPC callers, Zod schemas, error predicates |
| `src/features/contacts/hooks/use-contact-merges.ts` | `useDuplicateContactGroups`, `useContactMergeChildren`, `useMergeContacts` |
| `src/features/contacts/model/merge-candidate.ts` | `MergeCandidate` type + adapters + conflict/fill/survivor logic |
| `src/features/contacts/model/merge-candidate.test.ts` | unit tests for the above |
| `src/features/contacts/ui/merge-contacts-dialog.tsx` | the two-step dialog |
| `src/features/contacts/ui/merge-contacts-dialog.test.tsx` | component tests |
| `src/features/contacts/ui/duplicate-group-card.tsx` | one duplicate group in the duplicates view |
| `src/features/contacts/ui/duplicates-view.tsx` | the duplicates list, pagination, empty/error states |
| `src/features/contacts/ui/directory-view.tsx` | extracted live directory list + multi-select |
| `src/features/contacts/ui/archived-view.tsx` | extracted archived list, merged rows without Restore |

**Modified**

| Path | Change |
|---|---|
| `src/features/contacts/api/query-keys.ts` | `duplicates` / `duplicatesPage` / `mergeChildren` keys |
| `src/features/contacts/api/contacts.ts` | `ArchivedContact` gains `merged_into_id` and `merged_into_name` |
| `src/features/contacts/ui/contacts-page.tsx` | reduced to header + filters + view switch |
| `src/features/contacts/ui/archived-contact-row.tsx` | merged rows say so and drop Restore |
| `src/features/contacts/ui/contact-detail-page.tsx` | redirect when `merged_into_id` is set |
| `src/features/contacts/index.ts` | export the new public surface |
| `src/routes/_authenticated/workspaces/$id/contacts.tsx` | `duplicates` search param |
| `src/routes/_authenticated/workspaces/$id/contacts/index.tsx` | pass and patch `duplicates` |
| `src/entities/contact/model/types.ts` | `ContactDetail` gains `merged_into_id` |
| `messages/en.json`, `messages/ru.json` | all new keys |
| `src/lib/message-plurals.test.ts` | pins for the new counted messages |
| `src/lib/message-lengths.test.ts` | budgets for the picker's fixed-width labels |

---

### Task 1: Merge columns, the restore guard, and the archived listing

**Files:**
- Create: `supabase/migrations/20260810090000_contact_merge_columns.sql`
- Create: `supabase/tests/database/contact_merge.test.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.contacts.merged_into_id uuid`, `.merged_at timestamptz`, `.merged_by uuid`; constraints `contacts_merged_into_fkey`, `contacts_merged_is_archived_check`; index `contacts_merged_into_idx`. `public.restore_contact(uuid)` raises `CONTACT_IS_MERGED` (P0001) on a merged contact. `public.list_archived_contacts(uuid, text, integer, integer)` gains trailing columns `merged_into_id uuid, merged_into_name text` after `total_count`.

The columns and the `restore_contact` guard ship together on purpose: the check constraint without the guard turns every restore of a merged contact into a raw 23514.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/contact_merge.test.sql`. Fixture ids use the `80000000` range, which no other test file uses.

```sql
begin;

select plan(6);

-- Task 1 covers the columns, the merged-is-archived invariant and the
-- restore refusal. Tasks 2 and 3 append to this plan count.
--
-- Fixture numbering, 80000000 range, unused elsewhere:
--   users …01{01,02}  workspace …0201  channel …0301
--   contacts …04{01..04}  conversations …05{01,02}  messages …0601

insert into auth.users (id, email, raw_user_meta_data)
values
  ('80000000-0000-4000-8000-000000000101', 'merge-owner@example.com',
   '{"full_name":"Merge Owner"}'::jsonb),
  ('80000000-0000-4000-8000-000000000102', 'merge-member@example.com',
   '{"full_name":"Merge Member"}'::jsonb);

insert into public.workspaces (id, name, is_main, created_by)
values ('80000000-0000-4000-8000-000000000201', 'Merge WS', false,
        '80000000-0000-4000-8000-000000000101');

insert into public.workspace_members (workspace_id, user_id, role)
values ('80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000102', 'member');

insert into public.contacts (id, workspace_id, name, phone, email, source)
values
  ('80000000-0000-4000-8000-000000000401',
   '80000000-0000-4000-8000-000000000201', 'Иван Петров',
   '+7 999 123-45-67', 'ivan@example.com', 'telegram'),
  ('80000000-0000-4000-8000-000000000402',
   '80000000-0000-4000-8000-000000000201', 'Ivan P.',
   '+79991234567', null, 'manual');

-- ── The columns exist and carry the intended shape ───────────────────────────

select has_column('public', 'contacts', 'merged_into_id',
  'contacts carries merged_into_id');
select has_column('public', 'contacts', 'merged_at',
  'contacts carries merged_at');
select has_column('public', 'contacts', 'merged_by',
  'contacts carries merged_by');

-- ── merged implies archived ──────────────────────────────────────────────────

select throws_ok(
  $$
    update public.contacts
    set merged_into_id = '80000000-0000-4000-8000-000000000401'
    where id = '80000000-0000-4000-8000-000000000402'
  $$,
  '23514',
  null,
  'a live contact cannot carry merged_into_id'
);

-- Stamped together, the same way merge_contacts will stamp them.
update public.contacts
set deleted_at = now(),
    merged_into_id = '80000000-0000-4000-8000-000000000401',
    merged_at = now(),
    merged_by = '80000000-0000-4000-8000-000000000101'
where id = '80000000-0000-4000-8000-000000000402';

select is(
  (select merged_into_id from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'an archived contact may be marked merged'
);

-- ── restore refuses a merged contact ─────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$ select public.restore_contact('80000000-0000-4000-8000-000000000402') $$,
  'P0001',
  'CONTACT_IS_MERGED',
  'restore_contact refuses a merged contact rather than writing a row that violates the check'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — `has_column` fails on `merged_into_id`, and `restore_contact` succeeds instead of throwing.

If `supabase test db` cannot connect, start the shared instance first with `pnpm supabase:start`. Coordinate — it is one instance for the whole machine.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260810090000_contact_merge_columns.sql`:

```sql
-- Contact merge, part 1 of 3: the columns a merge leaves behind, and the two
-- existing functions that have to learn about them.
--
-- There is no merge-log table. The merged contact's row survives soft-deleted
-- with every scalar field untouched, so "what did this contact look like before"
-- is answered by reading it. merged_into_id records where it went; merged_at and
-- merged_by record when and by whom. Three columns replace a table whose only
-- other job would have been feeding an unmerge that this feature does not have.

begin;

alter table public.contacts
  add column merged_into_id uuid,
  add column merged_at      timestamptz,
  add column merged_by      uuid references public.profiles(id) on delete set null;

-- Composite, against the (workspace_id, id) unique key added in
-- 20260731143003: a merge must not be able to point across a workspace.
alter table public.contacts
  add constraint contacts_merged_into_fkey
  foreign key (workspace_id, merged_into_id)
  references public.contacts(workspace_id, id);

-- A merged contact is archived, always. Nothing may leave one live: the
-- directory has no way to render a contact whose children belong to someone
-- else, and every read path that hides archived rows would otherwise show it.
alter table public.contacts
  add constraint contacts_merged_is_archived_check
  check (merged_into_id is null or deleted_at is not null);

-- Partial: the overwhelming majority of contacts are never merged.
create index contacts_merged_into_idx
  on public.contacts (workspace_id, merged_into_id)
  where merged_into_id is not null;

comment on column public.contacts.merged_into_id is
  'The surviving contact this one was merged into, or NULL. Always accompanied by deleted_at. Never chains: merge_contacts refuses a contact that already carries one, so this points at a contact that has not itself been merged.';


-- =========================================================
-- restore_contact: refuse a merged contact
-- =========================================================
--
-- Without this, restoring a merged contact writes merged_into_id onto a row with
-- deleted_at null and fails the check constraint above with a raw 23514. It
-- would also be pointless: a restored merge-shell is a contact with no
-- conversations, notes, channels or phones, because they all belong to the
-- survivor now.
--
-- CREATE OR REPLACE preserves the grants from 20260808090100.

create or replace function public.restore_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_merged_into uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  select c.workspace_id, c.merged_into_id
  into v_workspace_id, v_merged_into
  from public.contacts c
  where c.id = p_contact_id;

  if v_workspace_id is null or not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = v_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  -- After the authority check, not before: "this contact was merged" is
  -- information, and a non-admin should not learn it from the error they get.
  if v_merged_into is not null then
    raise exception 'CONTACT_IS_MERGED'
      using errcode = 'P0001';
  end if;

  update public.contacts
  set
    deleted_at = null,
    updated_at = now()
  where id = p_contact_id
    and deleted_at is not null;
end;
$$;

comment on function public.restore_contact(uuid) is
  'Clears public.contacts.deleted_at and, through trg_cascade_contact_archive, that of its conversations. Owner/admin only. Refuses a merged contact: its children belong to the survivor, so restoring it would produce an empty shell and violate contacts_merged_is_archived_check.';


-- =========================================================
-- list_archived_contacts: say which rows are merged
-- =========================================================
--
-- The archived view has to tell a merged row from an archived one: the first
-- gets "merged into X" and no Restore button, the second keeps the button it has
-- today. Two trailing columns rather than a second RPC.
--
-- Signature is unchanged, so CREATE OR REPLACE keeps the grants. The RETURNS
-- TABLE gains columns at the END; adding them in the middle would silently
-- re-map every existing column for any caller reading positionally.

create or replace function public.list_archived_contacts(
  p_workspace_id uuid,
  p_query text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  workspace_id uuid,
  name text,
  display_name text,
  phone text,
  email text,
  avatar_url text,
  status text,
  source text,
  tags text[],
  owner_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  channel_types text[],
  conversation_count bigint,
  total_count bigint,
  merged_into_id uuid,
  merged_into_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_pattern text;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner', 'admin'])
      and w.deleted_at is null
  ) then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  if v_query is not null then
    v_query := left(v_query, 128);
    v_pattern := '%'
      || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_')
      || '%';
  end if;

  return query
  with matched as (
    select
      c.id as contact_id,
      dn.display_name,
      count(*) over () as match_total,
      row_number() over (
        order by c.deleted_at desc, c.id desc
      ) as sort_rank
    from public.contacts c
    left join lateral (
      select coalesce(
        nullif(btrim(c.name), ''),
        (
          select nullif(btrim(cc.external_name), '')
          from public.contact_channels cc
          where cc.contact_id = c.id
            and cc.workspace_id = c.workspace_id
            and nullif(btrim(cc.external_name), '') is not null
          order by cc.created_at asc, cc.id asc
          limit 1
        )
      ) as display_name
    ) dn on true
    where c.workspace_id = p_workspace_id
      and c.deleted_at is not null
      and (
        v_pattern is null
        or c.name ilike v_pattern
        or c.email ilike v_pattern
        or c.phone ilike v_pattern
      )
  ),
  page as (
    select m.contact_id, m.display_name, m.match_total, m.sort_rank
    from matched m
    order by m.sort_rank
    limit v_limit
    offset v_offset
  )
  select
    c.id,
    c.workspace_id,
    c.name,
    p.display_name,
    c.phone,
    c.email,
    c.avatar_url,
    c.status,
    c.source,
    c.tags,
    c.owner_id,
    c.last_seen_at,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    coalesce(ch.types, array[]::text[]),
    coalesce(cv.conversation_count, 0),
    p.match_total,
    c.merged_into_id,
    sv.display_name
  from page p
  join public.contacts c on c.id = p.contact_id
  left join lateral (
    select array_agg(distinct cc.channel_type order by cc.channel_type) as types
    from public.contact_channels cc
    where cc.contact_id = c.id
      and cc.workspace_id = c.workspace_id
  ) ch on true
  left join lateral (
    select count(*) as conversation_count
    from public.conversations cv2
    where cv2.contact_id = c.id
      and cv2.workspace_id = c.workspace_id
  ) cv on true
  -- The survivor's name, computed the same way, so the row can name it without
  -- a second request. Null when the row was archived rather than merged.
  left join lateral (
    select coalesce(
      nullif(btrim(s.name), ''),
      (
        select nullif(btrim(cc.external_name), '')
        from public.contact_channels cc
        where cc.contact_id = s.id
          and cc.workspace_id = s.workspace_id
          and nullif(btrim(cc.external_name), '') is not null
        order by cc.created_at asc, cc.id asc
        limit 1
      )
    ) as display_name
    from public.contacts s
    where s.id = c.merged_into_id
      and s.workspace_id = c.workspace_id
  ) sv on true
  order by p.sort_rank;
end;
$$;

comment on function public.list_archived_contacts(uuid, text, integer, integer) is
  'One page of a workspace''s archived contacts, newest archive first, for the directory''s Archived filter. SECURITY DEFINER so it can read rows the contacts SELECT policy hides; guarded to owner/admin. merged_into_id and merged_into_name are non-null for rows that were merged rather than archived; those rows are not restorable.';

commit;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test:db`
Expected: PASS — all 6 assertions in `contact_merge.test.sql`, and every other database test file still green. `contact_archive.test.sql` in particular must stay green: `list_archived_contacts` changed shape.

- [ ] **Step 5: Regenerate types and typecheck**

Run: `pnpm types:supabase:local && pnpm typecheck`
Expected: `src/api/types.ts` is rewritten by the generator (never by hand) and typecheck passes. `list_archived_contacts`' two new columns appear on its generated `Returns`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260810090000_contact_merge_columns.sql \
        supabase/tests/database/contact_merge.test.sql \
        src/api/types.ts
git commit -m "$(cat <<'EOF'
feat(db): add merge columns to contacts and teach restore about them

merged_into_id, merged_at and merged_by, with a check constraint that a
merged contact is always archived. restore_contact now refuses a merged
contact: restoring one would violate that constraint and produce an empty
shell whose children belong to the survivor. list_archived_contacts
returns the two columns the archived view needs to tell the cases apart.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The `merge_contacts` RPC

**Files:**
- Create: `supabase/migrations/20260810090100_merge_contacts.sql`
- Modify: `supabase/tests/database/contact_merge.test.sql` (raise `plan(6)` to `plan(20)`, append)

**Interfaces:**
- Consumes: Task 1's columns and constraints.
- Produces: `public.merge_contacts(p_survivor_id uuid, p_merged_id uuid, p_fields jsonb default '{}'::jsonb) returns void`. Error contract: `28000`/`NOT_AUTHENTICATED`; `42501`/`NOT_A_WORKSPACE_ADMIN` (also for a missing, archived or already-merged contact, and for a cross-workspace pair); `22023`/`CONTACT_MERGE_SAME_CONTACT`; `22023`/`CONTACT_MERGE_UNKNOWN_FIELD`; `22023`/`CONTACT_MERGE_INVALID_FIELD`; `P0001`/`CONTACT_MERGE_CONVERSATION_CONFLICT`. `p_fields` accepts only the keys `name`, `email`, `owner_id`, `status`, `avatar_url`, `source`.

- [ ] **Step 1: Write the failing tests**

In `supabase/tests/database/contact_merge.test.sql`, change `select plan(6);` to `select plan(20);` and append the following **before** `select * from finish();`.

The Task 1 fixture already merged …402 into …401, which would poison these cases, so this block starts by undoing that and building the real fixture.

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Task 2: merge_contacts
-- ═══════════════════════════════════════════════════════════════════════════

reset role;

-- Undo the Task 1 fixture merge so …401 and …402 are two live contacts again.
update public.contacts
set deleted_at = null, merged_into_id = null, merged_at = null, merged_by = null
where id = '80000000-0000-4000-8000-000000000402';

insert into public.channels (id, workspace_id, type, name, is_active)
values
  ('80000000-0000-4000-8000-000000000301',
   '80000000-0000-4000-8000-000000000201', 'telegram', 'Merge TG', true),
  ('80000000-0000-4000-8000-000000000302',
   '80000000-0000-4000-8000-000000000201', 'whatsapp', 'Merge WA', true);

-- …401 the survivor: one telegram thread with a message, two numbers, a note.
insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('80000000-0000-4000-8000-000000000501',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000401',
        '80000000-0000-4000-8000-000000000301');

insert into public.messages (id, workspace_id, conversation_id, direction, type, content)
values ('80000000-0000-4000-8000-000000000601',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000501',
        'inbound', 'text', 'survivor thread');

-- …402 the loser: a whatsapp thread, a shared number spelled differently, a
-- number the survivor does not have, a channel identity, and a note.
insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('80000000-0000-4000-8000-000000000502',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000402',
        '80000000-0000-4000-8000-000000000302');

insert into public.contact_phones (workspace_id, contact_id, phone, position)
values
  ('80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000401', '+7 999 123-45-67', 0),
  -- Same digits as the survivor's, spelled differently: must collapse, not 23505.
  ('80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000402', '+79991234567', 0),
  ('80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000402', '+7 916 000-11-22', 1);

insert into public.contact_channels
  (id, contact_id, workspace_id, channel_id, channel_type, external_id, external_name)
values ('80000000-0000-4000-8000-000000000701',
        '80000000-0000-4000-8000-000000000402',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000302',
        'whatsapp', '79991234567', 'Ivan P.');

insert into public.contact_notes (id, workspace_id, contact_id, body)
values ('80000000-0000-4000-8000-000000000801',
        '80000000-0000-4000-8000-000000000201',
        '80000000-0000-4000-8000-000000000402',
        'note that must survive the merge');

set local role authenticated;

-- ── Authority ────────────────────────────────────────────────────────────────

set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000102","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a plain member cannot merge contacts'
);

set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000401')
  $$,
  '22023',
  'CONTACT_MERGE_SAME_CONTACT',
  'a contact cannot be merged into itself'
);

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-0000000004ff')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a contact that does not exist is refused exactly like one the caller may not touch'
);

-- ── Field validation ─────────────────────────────────────────────────────────

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"deleted_at": "2020-01-01"}'::jsonb)
  $$,
  '22023',
  'CONTACT_MERGE_UNKNOWN_FIELD: deleted_at',
  'p_fields cannot name a column outside the allowlist'
);

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"status": "archived"}'::jsonb)
  $$,
  '22023',
  'CONTACT_MERGE_INVALID_FIELD: status',
  'p_fields cannot set a status the column check would reject'
);

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"owner_id": "80000000-0000-4000-8000-0000000001ff"}'::jsonb)
  $$,
  '22023',
  'CONTACT_MERGE_INVALID_FIELD: owner_id',
  'p_fields cannot assign an owner who is not a member of the workspace'
);

-- ── The merge itself ─────────────────────────────────────────────────────────

select lives_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402',
      '{"name": "Ivan P.", "email": "ivan@example.com"}'::jsonb)
  $$,
  'an admin merges two contacts in the same workspace'
);

reset role;

select is(
  (select count(*)::int from public.conversations
    where contact_id = '80000000-0000-4000-8000-000000000401'),
  2,
  'both conversations belong to the survivor'
);

-- The hazard the ordering in merge_contacts exists to prevent: the loser is
-- archived LAST, so trg_cascade_contact_archive finds no conversations of its
-- own to stamp and the moved threads stay live.
select is(
  (select count(*)::int from public.conversations
    where contact_id = '80000000-0000-4000-8000-000000000401'
      and deleted_at is null),
  2,
  'the moved conversations were not archived by the cascade trigger'
);

select is(
  (select contact_id from public.contact_notes
    where id = '80000000-0000-4000-8000-000000000801'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'the note moved to the survivor'
);

select is(
  (select contact_id from public.contact_channels
    where id = '80000000-0000-4000-8000-000000000701'),
  '80000000-0000-4000-8000-000000000401'::uuid,
  'the channel identity moved to the survivor'
);

-- Three phone rows existed; two spelled the same number. The survivor keeps two.
select is(
  (select count(*)::int from public.contact_phones
    where contact_id = '80000000-0000-4000-8000-000000000401'),
  2,
  'a number the survivor already held collapsed instead of raising 23505'
);

select is(
  (select count(*)::int from public.contact_phones
    where contact_id = '80000000-0000-4000-8000-000000000402'),
  0,
  'the loser keeps no phone rows'
);

select is(
  (select array_agg(position order by position)
     from public.contact_phones
    where contact_id = '80000000-0000-4000-8000-000000000401'),
  array[0, 1],
  'the survivor''s phone positions are renumbered contiguously from zero'
);

select is(
  (select phone from public.contacts
    where id = '80000000-0000-4000-8000-000000000401'),
  '+7 999 123-45-67',
  'contacts.phone still holds the survivor''s position-0 number'
);

select is(
  (select name from public.contacts
    where id = '80000000-0000-4000-8000-000000000401'),
  'Ivan P.',
  'the picked name overwrote the survivor''s'
);

select is(
  (select name from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  'Ivan P.',
  'the loser''s own scalars are untouched: its row is the record of what it was'
);

select is(
  (select merged_by from public.contacts
    where id = '80000000-0000-4000-8000-000000000402'),
  '80000000-0000-4000-8000-000000000101'::uuid,
  'merged_by records the acting admin'
);

select ok(
  (select deleted_at is not null and merged_at is not null
     from public.contacts where id = '80000000-0000-4000-8000-000000000402'),
  'the loser is archived and stamped in the same statement'
);

-- ── Already merged, and the conversation clash ───────────────────────────────

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000401',
      '80000000-0000-4000-8000-000000000402')
  $$,
  '42501',
  'NOT_A_WORKSPACE_ADMIN',
  'a contact that has already been merged cannot be merged again'
);

reset role;

-- Two fresh contacts, each with a thread on the SAME channel row. That pair
-- cannot be merged: conversations_contact_channel_unique (contact_id,
-- channel_id) would be violated, and folding the threads is a separate feature.
insert into public.contacts (id, workspace_id, name, source)
values
  ('80000000-0000-4000-8000-000000000403',
   '80000000-0000-4000-8000-000000000201', 'Clash A', 'telegram'),
  ('80000000-0000-4000-8000-000000000404',
   '80000000-0000-4000-8000-000000000201', 'Clash B', 'telegram');

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values
  ('80000000-0000-4000-8000-000000000503',
   '80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000403',
   '80000000-0000-4000-8000-000000000301'),
  ('80000000-0000-4000-8000-000000000504',
   '80000000-0000-4000-8000-000000000201',
   '80000000-0000-4000-8000-000000000404',
   '80000000-0000-4000-8000-000000000301');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"80000000-0000-4000-8000-000000000101","role":"authenticated"}';

select throws_ok(
  $$
    select public.merge_contacts(
      '80000000-0000-4000-8000-000000000403',
      '80000000-0000-4000-8000-000000000404')
  $$,
  'P0001',
  'CONTACT_MERGE_CONVERSATION_CONFLICT',
  'two contacts holding a thread on the same channel cannot be merged'
);

reset role;

select is(
  (select contact_id from public.conversations
    where id = '80000000-0000-4000-8000-000000000504'),
  '80000000-0000-4000-8000-000000000404'::uuid,
  'the refused merge moved nothing: the whole statement rolled back'
);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:db`
Expected: FAIL — `function public.merge_contacts(uuid, uuid) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260810090100_merge_contacts.sql`:

```sql
-- Contact merge, part 2 of 3: the mutation.
--
-- Repoints the four tables that reference a contact onto a survivor, applies the
-- scalar values a human picked, and archives the loser. One way: there is no
-- unmerge, and the only thing it destroys is whichever of the survivor's scalar
-- fields the picker chose to overwrite.
--
-- SECURITY DEFINER with an explicit owner/admin check, following
-- public.archive_contact. Merge is strictly more destructive than archive, so it
-- must not carry a weaker authority than archive does.

begin;

create or replace function public.merge_contacts(
  p_survivor_id uuid,
  p_merged_id uuid,
  p_fields jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_workspace_id uuid;
  v_merged_workspace_id uuid;
  v_key text;
  v_status text;
  v_source text;
  v_owner uuid;
  v_primary_phone text;
begin
  if v_actor is null then
    raise exception 'NOT_AUTHENTICATED'
      using errcode = '28000';
  end if;

  if p_survivor_id = p_merged_id then
    raise exception 'CONTACT_MERGE_SAME_CONTACT'
      using errcode = '22023';
  end if;

  -- Locked in id order. Two admins merging the same pair in opposite directions
  -- would otherwise take the two row locks in opposite orders and deadlock.
  perform 1
  from public.contacts c
  where c.id in (p_survivor_id, p_merged_id)
  order by c.id
  for update;

  -- Both sides must be live and not already merged. Folding those conditions
  -- into the lookup means every failure reaching the check below is reported
  -- identically, which is the point.
  select c.workspace_id into v_workspace_id
  from public.contacts c
  where c.id = p_survivor_id
    and c.deleted_at is null
    and c.merged_into_id is null;

  select c.workspace_id into v_merged_workspace_id
  from public.contacts c
  where c.id = p_merged_id
    and c.deleted_at is null
    and c.merged_into_id is null;

  -- One error for "no such contact", "already archived or merged", "a different
  -- workspace" and "not an admin here". A definer function that distinguishes
  -- them tells any authenticated caller whether an arbitrary uuid names a real
  -- contact, and in which workspace.
  if v_workspace_id is null
     or v_merged_workspace_id is null
     or v_workspace_id <> v_merged_workspace_id
     or not exists (
       select 1
       from public.workspace_members wm
       where wm.workspace_id = v_workspace_id
         and wm.user_id = v_actor
         and wm.role = any (array['owner', 'admin'])
     )
  then
    raise exception 'NOT_A_WORKSPACE_ADMIN'
      using errcode = '42501';
  end if;

  -- conversations_contact_channel_unique (contact_id, channel_id) cannot be
  -- relaxed: all three inbound resolvers use it as an ON CONFLICT target. So a
  -- pair holding threads on one channel is refused rather than folded, which
  -- would mean repointing messages and recomputing every counter.
  if exists (
    select 1
    from public.conversations a
    join public.conversations b on b.channel_id = a.channel_id
    where a.contact_id = p_survivor_id
      and b.contact_id = p_merged_id
  ) then
    raise exception 'CONTACT_MERGE_CONVERSATION_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- The client chooses which VALUE wins. It never names a column: an unfiltered
  -- jsonb applied to an UPDATE is a way to write deleted_at, workspace_id or
  -- merged_into_id from the browser.
  for v_key in select jsonb_object_keys(p_fields) loop
    if v_key not in ('name', 'email', 'owner_id', 'status', 'avatar_url', 'source') then
      raise exception 'CONTACT_MERGE_UNKNOWN_FIELD: %', v_key
        using errcode = '22023';
    end if;
  end loop;

  -- Each value is checked against what the column would accept anyway, so the
  -- caller gets a named error instead of a raw 23514 three statements later.
  if p_fields ? 'status' then
    v_status := p_fields ->> 'status';
    if v_status is null
       or v_status not in ('new', 'in_progress', 'done', 'lost') then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: status'
        using errcode = '22023';
    end if;
  end if;

  if p_fields ? 'source' then
    v_source := p_fields ->> 'source';
    if v_source is not null
       and v_source not in ('whatsapp', 'instagram', 'telegram', 'email', 'manual') then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: source'
        using errcode = '22023';
    end if;
  end if;

  if p_fields ? 'owner_id' then
    begin
      v_owner := nullif(p_fields ->> 'owner_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: owner_id'
        using errcode = '22023';
    end;

    if v_owner is not null and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = v_workspace_id
        and wm.user_id = v_owner
    ) then
      raise exception 'CONTACT_MERGE_INVALID_FIELD: owner_id'
        using errcode = '22023';
    end if;
  end if;

  -- Absent keys leave the column alone; present keys overwrite it. Tags are
  -- always the union and are never a choice: a tag is a label somebody applied
  -- to this person, and the merge does not make it untrue.
  update public.contacts c
  set
    name = case when p_fields ? 'name'
      then nullif(btrim(coalesce(p_fields ->> 'name', '')), '') else c.name end,
    email = case when p_fields ? 'email'
      then nullif(btrim(coalesce(p_fields ->> 'email', '')), '') else c.email end,
    avatar_url = case when p_fields ? 'avatar_url'
      then nullif(p_fields ->> 'avatar_url', '') else c.avatar_url end,
    status = case when p_fields ? 'status' then v_status else c.status end,
    source = case when p_fields ? 'source' then v_source else c.source end,
    owner_id = case when p_fields ? 'owner_id' then v_owner else c.owner_id end,
    tags = (
      select coalesce(array_agg(distinct u.tag order by u.tag), array[]::text[])
      from (
        select unnest(c.tags) as tag
        union
        select unnest(mc.tags)
        from public.contacts mc
        where mc.id = p_merged_id
      ) u
    ),
    -- GREATEST ignores nulls, so a contact that has never been seen does not
    -- erase the other one's timestamp.
    last_seen_at = greatest(
      c.last_seen_at,
      (select mc.last_seen_at from public.contacts mc where mc.id = p_merged_id)
    ),
    updated_at = now()
  where c.id = p_survivor_id;

  update public.conversations
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  update public.contact_notes
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  update public.contact_channels
  set contact_id = p_survivor_id
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  -- contact_phones_contact_digits_key is (contact_id, digits): a number the
  -- survivor already holds cannot move, so it is left behind and deleted below.
  -- Nothing is lost -- the survivor has that number, however it was spelled.
  update public.contact_phones cp
  set contact_id = p_survivor_id
  where cp.contact_id = p_merged_id
    and cp.workspace_id = v_workspace_id
    and not exists (
      select 1
      from public.contact_phones s
      where s.contact_id = p_survivor_id
        and s.digits = cp.digits
    );

  delete from public.contact_phones
  where contact_id = p_merged_id
    and workspace_id = v_workspace_id;

  -- Moved rows arrive carrying the loser's positions, so the survivor can end up
  -- with two position-0 numbers and no defined primary. Renumber, then re-sync
  -- contacts.phone the way set_contact_phones does.
  with ordered as (
    select
      cp.id,
      (row_number() over (order by cp.position, cp.created_at, cp.id) - 1)::integer as rank
    from public.contact_phones cp
    where cp.contact_id = p_survivor_id
      and cp.workspace_id = v_workspace_id
  )
  update public.contact_phones cp
  set position = ordered.rank
  from ordered
  where cp.id = ordered.id
    and cp.position is distinct from ordered.rank;

  select cp.phone into v_primary_phone
  from public.contact_phones cp
  where cp.contact_id = p_survivor_id
    and cp.workspace_id = v_workspace_id
  order by cp.position, cp.created_at, cp.id
  limit 1;

  -- COALESCE, not a bare assignment: a survivor with no contact_phones rows at
  -- all is a pre-20260803120000 row whose only number lives in the column.
  update public.contacts c
  set phone = coalesce(v_primary_phone, c.phone)
  where c.id = p_survivor_id
    and c.phone is distinct from coalesce(v_primary_phone, c.phone);

  -- LAST. trg_cascade_contact_archive stamps deleted_at onto the conversations
  -- of a contact being archived; by now this contact has none, because they all
  -- moved above. Stamping first would archive the survivor's new threads.
  update public.contacts
  set
    deleted_at = now(),
    merged_into_id = p_survivor_id,
    merged_at = now(),
    merged_by = v_actor,
    updated_at = now()
  where id = p_merged_id;
end;
$$;

comment on function public.merge_contacts(uuid, uuid, jsonb) is
  'Merges p_merged_id into p_survivor_id: repoints conversations, notes, channels and phones, applies the allowlisted scalar values in p_fields, unions tags, then archives the loser with merged_into_id. Owner/admin only, one workspace, one way -- there is no unmerge. Refuses a pair holding conversations on the same channel.';

revoke all on function public.merge_contacts(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.merge_contacts(uuid, uuid, jsonb) to authenticated;

commit;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:db`
Expected: PASS — 20 assertions in `contact_merge.test.sql`, every other file still green.

- [ ] **Step 5: Regenerate types and typecheck**

Run: `pnpm types:supabase:local && pnpm typecheck`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260810090100_merge_contacts.sql \
        supabase/tests/database/contact_merge.test.sql \
        src/api/types.ts
git commit -m "$(cat <<'EOF'
feat(db): add merge_contacts

Repoints conversations, notes, channels and phones onto a survivor,
applies allowlisted scalar overrides, unions tags, then archives the
loser. Owner/admin only, following archive_contact.

Two orderings are load-bearing and both are tested: the rows are locked
in id order so concurrent opposite-direction merges cannot deadlock, and
the loser is archived last so trg_cascade_contact_archive cannot stamp
deleted_at onto conversations that have just become the survivor's.

A pair holding threads on the same channel is refused rather than folded:
conversations_contact_channel_unique is an ON CONFLICT target for all
three inbound resolvers and cannot be relaxed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The duplicate finder and the child counts

**Files:**
- Create: `supabase/migrations/20260810090200_duplicate_contact_groups.sql`
- Create: `supabase/tests/database/contact_duplicates.test.sql`

**Interfaces:**
- Consumes: nothing from Tasks 1–2 (independent, but ordered after them so one migration series lands in sequence).
- Produces:
  - `public.list_duplicate_contact_groups(p_workspace_id uuid, p_limit integer default 20, p_offset integer default 0) returns table (group_key text, match_reason text, contacts jsonb, contact_count integer, total_count bigint)`. Each element of `contacts` is `{id, display_name, phone, email, avatar_url, status, source, owner_id, tags, last_seen_at, conversation_count}`.
  - `public.count_contact_merge_children(p_workspace_id uuid, p_contact_id uuid) returns table (conversation_count integer, note_count integer, phone_count integer, channel_count integer)`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/contact_duplicates.test.sql`. Fixture ids use the `90000000` range.

```sql
begin;

select plan(8);

-- The duplicate finder groups live contacts that share an exact identity key:
-- normalized phone digits, a channel identity, or a lowercased email. It never
-- groups on a name -- two people share a name far more often than a number.
--
-- Fixture numbering, 90000000 range, unused elsewhere:
--   users …0101  workspaces …02{01,02}  channels …03{01,02}
--   contacts …04{01..06}  conversations …0501

insert into auth.users (id, email, raw_user_meta_data)
values ('90000000-0000-4000-8000-000000000101', 'dup-owner@example.com',
        '{"full_name":"Dup Owner"}'::jsonb);

insert into public.workspaces (id, name, is_main, created_by)
values
  ('90000000-0000-4000-8000-000000000201', 'Dup WS', false,
   '90000000-0000-4000-8000-000000000101'),
  -- A second workspace the user is NOT a member of, to prove the boundary.
  ('90000000-0000-4000-8000-000000000202', 'Other WS', false,
   '90000000-0000-4000-8000-000000000101');

delete from public.workspace_members
where workspace_id = '90000000-0000-4000-8000-000000000202';

insert into public.channels (id, workspace_id, type, name, is_active)
values ('90000000-0000-4000-8000-000000000301',
        '90000000-0000-4000-8000-000000000201', 'telegram', 'Dup TG', true);

insert into public.contacts (id, workspace_id, name, phone, email, source)
values
  -- …401/…402 share a number, spelled two ways, AND an email. One group.
  ('90000000-0000-4000-8000-000000000401',
   '90000000-0000-4000-8000-000000000201', 'Мария И.',
   '+7 999 555-11-22', 'maria@example.com', 'telegram'),
  ('90000000-0000-4000-8000-000000000402',
   '90000000-0000-4000-8000-000000000201', 'Maria I.',
   '+79995551122', 'MARIA@example.com', 'manual'),
  -- …403/…404 share only an email.
  ('90000000-0000-4000-8000-000000000403',
   '90000000-0000-4000-8000-000000000201', 'Пётр',
   null, 'petr@example.com', 'manual'),
  ('90000000-0000-4000-8000-000000000404',
   '90000000-0000-4000-8000-000000000201', 'Petr',
   null, 'petr@example.com', 'manual'),
  -- …405 is archived and shares …403's email: it must not appear.
  ('90000000-0000-4000-8000-000000000405',
   '90000000-0000-4000-8000-000000000201', 'Archived Petr',
   null, 'petr@example.com', 'manual'),
  -- …406 is alone.
  ('90000000-0000-4000-8000-000000000406',
   '90000000-0000-4000-8000-000000000201', 'Один',
   '+7 903 000-00-00', null, 'manual');

update public.contacts
set deleted_at = now()
where id = '90000000-0000-4000-8000-000000000405';

-- Two contacts in the other workspace sharing an email.
insert into public.contacts (id, workspace_id, name, email, source)
values
  ('90000000-0000-4000-8000-000000000501',
   '90000000-0000-4000-8000-000000000202', 'Hidden A', 'hidden@example.com', 'manual'),
  ('90000000-0000-4000-8000-000000000502',
   '90000000-0000-4000-8000-000000000202', 'Hidden B', 'hidden@example.com', 'manual');

insert into public.contact_phones (workspace_id, contact_id, phone, position)
values
  ('90000000-0000-4000-8000-000000000201',
   '90000000-0000-4000-8000-000000000401', '+7 999 555-11-22', 0),
  ('90000000-0000-4000-8000-000000000201',
   '90000000-0000-4000-8000-000000000402', '+79995551122', 0);

insert into public.conversations (id, workspace_id, contact_id, channel_id)
values ('90000000-0000-4000-8000-000000000601',
        '90000000-0000-4000-8000-000000000201',
        '90000000-0000-4000-8000-000000000401',
        '90000000-0000-4000-8000-000000000301');

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"90000000-0000-4000-8000-000000000101","role":"authenticated"}';

-- ── Grouping ─────────────────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')),
  2,
  'two groups: the phone/email pair and the email-only pair'
);

select is(
  (select match_reason from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where '90000000-0000-4000-8000-000000000401' =
          any (select (value ->> 'id')::uuid from jsonb_array_elements(contacts))),
  'phone',
  'a pair matching on both phone and email is reported once, under phone'
);

select is(
  (select contact_count from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where match_reason = 'email'),
  2,
  'the archived contact sharing that email is not counted'
);

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where '90000000-0000-4000-8000-000000000406' =
          any (select (value ->> 'id')::uuid from jsonb_array_elements(contacts))),
  0,
  'a contact with no twin is in no group'
);

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000202')),
  0,
  'a workspace the caller does not belong to yields nothing: RLS is the boundary'
);

select is(
  (select (contacts -> 0 ->> 'conversation_count')::int
     from public.list_duplicate_contact_groups(
       '90000000-0000-4000-8000-000000000201')
    where match_reason = 'phone'),
  1,
  'each member carries its conversation count, for the survivor default'
);

-- ── Legacy rows ──────────────────────────────────────────────────────────────
--
-- …403/…404 have no contact_phones rows at all. Give one of them a number that
-- lives only in contacts.phone, matching a number …406 holds, and the pair must
-- still group -- rows written before 20260803120000 are not invisible.

reset role;
update public.contacts set phone = '+7 903 000-00-00'
where id = '90000000-0000-4000-8000-000000000403';

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"90000000-0000-4000-8000-000000000101","role":"authenticated"}';

select is(
  (select count(*)::int from public.list_duplicate_contact_groups(
     '90000000-0000-4000-8000-000000000201')
    where match_reason = 'phone'),
  2,
  'a number held only in contacts.phone still groups'
);

-- ── Child counts ─────────────────────────────────────────────────────────────

select results_eq(
  $$
    select conversation_count, note_count, phone_count, channel_count
    from public.count_contact_merge_children(
      '90000000-0000-4000-8000-000000000201',
      '90000000-0000-4000-8000-000000000401')
  $$,
  $$ values (1, 0, 1, 0) $$,
  'the merge preview counts exactly what will move'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:db`
Expected: FAIL — `function public.list_duplicate_contact_groups(uuid) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260810090200_duplicate_contact_groups.sql`:

```sql
-- Contact merge, part 3 of 3: finding the duplicates, and counting what a merge
-- would move.
--
-- Exact identity keys only, the same three the product already trusts in
-- public.match_workspace_contacts: normalized phone digits, a channel identity,
-- an exact email. A display name is not a key and never will be -- two people
-- share a name far more often than they share a number, and a name-based
-- "duplicate" invites someone to collapse two real customers.

begin;

create or replace function public.list_duplicate_contact_groups(
  p_workspace_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  group_key text,
  match_reason text,
  contacts jsonb,
  contact_count integer,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  return query
  -- SECURITY INVOKER: RLS on public.contacts is the boundary and p_workspace_id
  -- only narrows, exactly as in match_workspace_contacts. Archived and merged
  -- rows are excluded here so a merged contact never reappears as its own
  -- duplicate.
  with live as (
    select
      c.id, c.workspace_id, c.name, c.phone, c.email, c.avatar_url,
      c.status, c.source, c.owner_id, c.tags, c.last_seen_at
    from public.contacts c
    where c.workspace_id = p_workspace_id
      and c.deleted_at is null
  ),
  keyed as (
    select 1 as rank, 'phone'::text as reason, cp.digits as key, cp.contact_id
    from public.contact_phones cp
    join live l on l.id = cp.contact_id
    where cp.workspace_id = p_workspace_id

    union

    -- Rows written before 20260803120000, or by anything other than
    -- set_contact_phones, hold their only number in the column.
    select 1, 'phone', public.phone_digits(l.phone), l.id
    from live l
    where l.phone is not null
      and char_length(public.phone_digits(l.phone)) >= 5

    union

    -- Keyed by type:id so a Telegram user id cannot match a wa_id that happens
    -- to be the same digits. Because (channel_id, external_id) is globally
    -- unique, this only ever groups across different channel rows of one type.
    select 2, 'channel', cc.channel_type || ':' || cc.external_id, cc.contact_id
    from public.contact_channels cc
    join live l on l.id = cc.contact_id
    where cc.workspace_id = p_workspace_id

    union

    select 3, 'email', lower(btrim(l.email)), l.id
    from live l
    where nullif(btrim(l.email), '') is not null
  ),
  grouped as (
    select
      k.rank,
      k.reason,
      k.key,
      -- DISTINCT sorts, which is what makes the dedupe below comparable.
      array_agg(distinct k.contact_id) as ids
    from keyed k
    group by k.rank, k.reason, k.key
    having count(distinct k.contact_id) > 1
  ),
  -- One row per member set. A pair sharing a number AND an email is one
  -- duplicate, reported under the strongest reason rather than twice.
  deduped as (
    select distinct on (g.ids) g.rank, g.reason, g.key, g.ids
    from grouped g
    order by g.ids, g.rank, g.key
  ),
  ranked as (
    select
      d.rank, d.reason, d.key, d.ids,
      count(*) over () as match_total,
      row_number() over (
        order by d.rank, cardinality(d.ids) desc, d.key
      ) as sort_rank
    from deduped d
  ),
  page as (
    select r.rank, r.reason, r.key, r.ids, r.match_total, r.sort_rank
    from ranked r
    order by r.sort_rank
    limit v_limit
    offset v_offset
  )
  -- Members are built after the page is cut, so the per-member subqueries run
  -- v_limit times rather than once per duplicate in the workspace.
  select
    p.key,
    p.reason,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          -- Computed exactly as search_workspace_contacts and
          -- list_archived_contacts compute it, so a row reads the same in all
          -- three views.
          'display_name', coalesce(
            nullif(btrim(l.name), ''),
            (
              select nullif(btrim(cc.external_name), '')
              from public.contact_channels cc
              where cc.contact_id = l.id
                and cc.workspace_id = l.workspace_id
                and nullif(btrim(cc.external_name), '') is not null
              order by cc.created_at asc, cc.id asc
              limit 1
            )
          ),
          -- Both. display_name is what the row shows; name is what a merge
          -- would actually write to contacts.name, and they differ whenever a
          -- contact has no name of its own and borrowed a channel handle.
          -- Merging the borrowed handle into the name column would invent a
          -- name nobody typed.
          'name', l.name,
          'phone', l.phone,
          'email', l.email,
          'avatar_url', l.avatar_url,
          'status', l.status,
          'source', l.source,
          'owner_id', l.owner_id,
          'tags', to_jsonb(l.tags),
          'last_seen_at', l.last_seen_at,
          'conversation_count', (
            select count(*)
            from public.conversations cv
            where cv.contact_id = l.id
              and cv.workspace_id = l.workspace_id
          )
        )
        order by l.last_seen_at desc nulls last, l.id
      )
      from live l
      where l.id = any (p.ids)
    ),
    cardinality(p.ids)::integer,
    p.match_total
  from page p
  order by p.sort_rank;
end;
$$;

comment on function public.list_duplicate_contact_groups(uuid, integer, integer) is
  'Groups of live contacts in one workspace that share an exact identity key -- normalized phone digits, channel_type:external_id, or a lowercased email -- strongest reason first, one row per member set. Never groups on a display name. SECURITY INVOKER: RLS on public.contacts is the boundary.';

revoke all on function public.list_duplicate_contact_groups(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.list_duplicate_contact_groups(uuid, integer, integer)
  to authenticated;


-- =========================================================
-- count_contact_merge_children
-- =========================================================
--
-- What a merge would move, for the confirmation step. Four counts in one round
-- trip rather than four queries the dialog would have to assemble, and it is the
-- same answer whichever entry point opened the dialog.

create or replace function public.count_contact_merge_children(
  p_workspace_id uuid,
  p_contact_id uuid
)
returns table (
  conversation_count integer,
  note_count integer,
  phone_count integer,
  channel_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*)::integer from public.conversations cv
      where cv.contact_id = p_contact_id and cv.workspace_id = p_workspace_id),
    (select count(*)::integer from public.contact_notes cn
      where cn.contact_id = p_contact_id and cn.workspace_id = p_workspace_id),
    (select count(*)::integer from public.contact_phones cp
      where cp.contact_id = p_contact_id and cp.workspace_id = p_workspace_id),
    (select count(*)::integer from public.contact_channels cc
      where cc.contact_id = p_contact_id and cc.workspace_id = p_workspace_id)
$$;

comment on function public.count_contact_merge_children(uuid, uuid) is
  'Conversations, notes, phones and channels attached to one contact -- what a merge would move. SECURITY INVOKER; RLS is the boundary.';

revoke all on function public.count_contact_merge_children(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.count_contact_merge_children(uuid, uuid)
  to authenticated;

commit;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:db`
Expected: PASS — 8 assertions in `contact_duplicates.test.sql`, everything else still green.

- [ ] **Step 5: Regenerate types and typecheck**

Run: `pnpm types:supabase:local && pnpm typecheck`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260810090200_duplicate_contact_groups.sql \
        supabase/tests/database/contact_duplicates.test.sql \
        src/api/types.ts
git commit -m "$(cat <<'EOF'
feat(db): find duplicate contacts by exact identity key

list_duplicate_contact_groups groups live contacts sharing normalized
phone digits, a channel identity, or a lowercased email -- the same three
keys match_workspace_contacts already trusts, and never a display name.
A pair matching on several keys is one group under the strongest reason.

count_contact_merge_children returns what a merge would move, so the
confirmation can state exact numbers from one round trip.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Messages for both locales

**Files:**
- Modify: `messages/en.json`, `messages/ru.json`
- Modify: `src/lib/message-plurals.test.ts`
- Modify: `src/lib/message-lengths.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: every `contacts_duplicates_*` and `contacts_merge_*` message id used by Tasks 6–9. Counted ids take `{ count: number }`; `contacts_merge_confirm_body` takes `{ merged: string, survivor: string }`; `contacts_merge_confirm_override` takes `{ field: string, before: string, after: string }`; `contacts_merge_clash_body` takes `{ channel: string }`; `contacts_archived_merged_into` takes `{ name: string }`.

Messages come before the UI so no task is tempted to hardcode a string "for now".

- [ ] **Step 1: Write the failing tests**

Append to the `describe('ru counted messages agree with their number')` block in `src/lib/message-plurals.test.ts`:

```ts
  it('declines what a merge moves', () => {
    expect(m.contacts_merge_moves_conversations({ count: 1 }, ru)).toBe('1 диалог')
    expect(m.contacts_merge_moves_conversations({ count: 3 }, ru)).toBe('3 диалога')
    expect(m.contacts_merge_moves_conversations({ count: 8 }, ru)).toBe('8 диалогов')
    expect(m.contacts_merge_moves_conversations({ count: 21 }, ru)).toBe('21 диалог')

    expect(m.contacts_merge_moves_notes({ count: 1 }, ru)).toBe('1 заметка')
    expect(m.contacts_merge_moves_notes({ count: 2 }, ru)).toBe('2 заметки')
    expect(m.contacts_merge_moves_notes({ count: 6 }, ru)).toBe('6 заметок')

    expect(m.contacts_merge_moves_phones({ count: 1 }, ru)).toBe('1 номер')
    expect(m.contacts_merge_moves_phones({ count: 2 }, ru)).toBe('2 номера')
    expect(m.contacts_merge_moves_phones({ count: 5 }, ru)).toBe('5 номеров')

    expect(m.contacts_merge_moves_channels({ count: 1 }, ru)).toBe('1 канал')
    expect(m.contacts_merge_moves_channels({ count: 2 }, ru)).toBe('2 канала')
    expect(m.contacts_merge_moves_channels({ count: 5 }, ru)).toBe('5 каналов')
  })

  it('declines the duplicate counts', () => {
    expect(m.contacts_duplicates_count({ count: 1 }, ru)).toBe('1 совпадение')
    expect(m.contacts_duplicates_count({ count: 2 }, ru)).toBe('2 совпадения')
    expect(m.contacts_duplicates_count({ count: 7 }, ru)).toBe('7 совпадений')
    expect(m.contacts_duplicates_count({ count: 21 }, ru)).toBe('21 совпадение')

    expect(m.contacts_duplicates_group_size({ count: 2 }, ru)).toBe('2 контакта')
    expect(m.contacts_duplicates_group_size({ count: 5 }, ru)).toBe('5 контактов')
  })

  it('says the merge cannot be undone, in the base locale', () => {
    // The whole design turns on this sentence being true and being read. An
    // archived contact comes back by itself; a merged one does not.
    expect(m.contacts_merge_confirm_irreversible(ru)).toContain('нельзя отменить')
  })
```

Add to the `BUDGETS` array in `src/lib/message-lengths.test.ts`:

```ts
  // The merge picker is a two-column comparison inside a 560px dialog: each
  // field label sits in a fixed left column, and each column header sits above
  // a value that is already truncating.
  { key: 'contacts_merge_field_name', max: 18, where: 'merge picker field label' },
  { key: 'contacts_merge_field_email', max: 18, where: 'merge picker field label' },
  { key: 'contacts_merge_field_owner', max: 18, where: 'merge picker field label' },
  { key: 'contacts_merge_field_status', max: 18, where: 'merge picker field label' },
  { key: 'contacts_merge_field_avatar', max: 18, where: 'merge picker field label' },
  { key: 'contacts_merge_field_source', max: 18, where: 'merge picker field label' },
  { key: 'contacts_merge_keep_label', max: 28, where: 'merge picker survivor radio' },
  // Reason chips sit inline on a duplicate group header beside a count.
  { key: 'contacts_duplicates_reason_phone', max: 26, where: 'duplicate reason chip' },
  { key: 'contacts_duplicates_reason_channel', max: 26, where: 'duplicate reason chip' },
  { key: 'contacts_duplicates_reason_email', max: 26, where: 'duplicate reason chip' },
  // The third filter chip, on one row with the status chips and Архив.
  { key: 'contacts_filter_duplicates', max: 18, where: 'contacts filter row' },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/message-plurals.test.ts src/lib/message-lengths.test.ts`
Expected: FAIL — the message ids do not exist, so `m.contacts_merge_moves_conversations` is undefined and the length lookups get `undefined` instead of a string.

- [ ] **Step 3: Add the messages**

Add to `messages/ru.json`, next to the existing `contacts_*` keys:

```json
  "contacts_filter_duplicates": "Дубликаты",
  "contacts_duplicates_notice": "Контакты, у которых совпадает номер, канал или email. Совпадение по имени не учитывается.",
  "contacts_duplicates_empty_title": "Дубликатов нет",
  "contacts_duplicates_empty_description": "Здесь появятся контакты с одинаковым номером, каналом или email.",
  "contacts_duplicates_load_error": "Не удалось загрузить дубликаты",
  "contacts_duplicates_reason_phone": "Совпадает номер",
  "contacts_duplicates_reason_channel": "Совпадает канал",
  "contacts_duplicates_reason_email": "Совпадает email",
  "contacts_duplicates_merge_action": "Объединить",
  "contacts_duplicates_count": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} совпадение",
        "countPlural=few": "{count} совпадения",
        "countPlural=*": "{count} совпадений"
      }
    }
  ],
  "contacts_duplicates_group_size": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} контакт",
        "countPlural=few": "{count} контакта",
        "countPlural=*": "{count} контактов"
      }
    }
  ],
  "contacts_merge_selected": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "Выбран {count} контакт",
        "countPlural=few": "Выбрано {count} контакта",
        "countPlural=*": "Выбрано {count} контактов"
      }
    }
  ],
  "contacts_merge_selection_hint": "Выберите ровно два контакта, чтобы объединить их.",
  "contacts_merge_selection_clear": "Снять выделение",
  "contacts_merge_title": "Объединение контактов",
  "contacts_merge_subtitle": "Выберите, какой контакт останется и какие данные сохранить.",
  "contacts_merge_keep_label": "Какой контакт останется",
  "contacts_merge_conflicts_label": "Что сохранить",
  "contacts_merge_no_conflicts": "Данные контактов не противоречат друг другу — объединение ничего не перезапишет.",
  "contacts_merge_always_kept": "Телефоны, каналы, диалоги, заметки и теги обоих контактов сохранятся.",
  "contacts_merge_field_name": "Имя",
  "contacts_merge_field_email": "Email",
  "contacts_merge_field_owner": "Ответственный",
  "contacts_merge_field_status": "Статус",
  "contacts_merge_field_avatar": "Фото",
  "contacts_merge_field_source": "Источник",
  "contacts_merge_value_empty": "Не указано",
  "contacts_merge_continue": "Продолжить",
  "contacts_merge_back": "Назад",
  "contacts_merge_confirm_title": "Объединить контакты?",
  "contacts_merge_confirm_body": "«{merged}» будет объединён с «{survivor}» и отправлен в архив.",
  "contacts_merge_confirm_moves": "Перейдут к «{survivor}»: {summary}.",
  "contacts_merge_confirm_override": "{field}: «{before}» будет заменено на «{after}».",
  "contacts_merge_confirm_irreversible": "Это действие нельзя отменить.",
  "contacts_merge_confirm_action": "Объединить",
  "contacts_merge_clash_title": "Эти контакты нельзя объединить",
  "contacts_merge_clash_body": "У обоих есть диалог в канале «{channel}». Объединение таких диалогов пока не поддерживается.",
  "contacts_merge_error": "Не удалось объединить контакты",
  "contacts_merge_error_not_admin": "Объединять контакты могут только владелец и администраторы",
  "contacts_merged_toast": "Контакты объединены",
  "contacts_archived_merged_into": "Объединён с «{name}»",
  "contact_detail_merged_redirect": "Этот контакт был объединён с другим",
  "contacts_merge_moves_conversations": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} диалог",
        "countPlural=few": "{count} диалога",
        "countPlural=*": "{count} диалогов"
      }
    }
  ],
  "contacts_merge_moves_notes": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} заметка",
        "countPlural=few": "{count} заметки",
        "countPlural=*": "{count} заметок"
      }
    }
  ],
  "contacts_merge_moves_phones": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} номер",
        "countPlural=few": "{count} номера",
        "countPlural=*": "{count} номеров"
      }
    }
  ],
  "contacts_merge_moves_channels": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} канал",
        "countPlural=few": "{count} канала",
        "countPlural=*": "{count} каналов"
      }
    }
  ],
```

Add the matching keys to `messages/en.json`. English needs only `one` and `*`:

```json
  "contacts_filter_duplicates": "Duplicates",
  "contacts_duplicates_notice": "Contacts sharing a phone number, channel or email. Name matches are not considered.",
  "contacts_duplicates_empty_title": "No duplicates",
  "contacts_duplicates_empty_description": "Contacts sharing a phone number, channel or email will appear here.",
  "contacts_duplicates_load_error": "Could not load duplicates",
  "contacts_duplicates_reason_phone": "Same phone number",
  "contacts_duplicates_reason_channel": "Same channel",
  "contacts_duplicates_reason_email": "Same email",
  "contacts_duplicates_merge_action": "Merge",
  "contacts_duplicates_count": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} match",
        "countPlural=*": "{count} matches"
      }
    }
  ],
  "contacts_duplicates_group_size": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} contact",
        "countPlural=*": "{count} contacts"
      }
    }
  ],
  "contacts_merge_selected": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} contact selected",
        "countPlural=*": "{count} contacts selected"
      }
    }
  ],
  "contacts_merge_selection_hint": "Select exactly two contacts to merge them.",
  "contacts_merge_selection_clear": "Clear selection",
  "contacts_merge_title": "Merge contacts",
  "contacts_merge_subtitle": "Choose which contact stays and which details to keep.",
  "contacts_merge_keep_label": "Contact to keep",
  "contacts_merge_conflicts_label": "Details to keep",
  "contacts_merge_no_conflicts": "These contacts do not disagree on anything — merging overwrites nothing.",
  "contacts_merge_always_kept": "Phones, channels, conversations, notes and tags from both contacts are kept.",
  "contacts_merge_field_name": "Name",
  "contacts_merge_field_email": "Email",
  "contacts_merge_field_owner": "Owner",
  "contacts_merge_field_status": "Status",
  "contacts_merge_field_avatar": "Photo",
  "contacts_merge_field_source": "Source",
  "contacts_merge_value_empty": "Not set",
  "contacts_merge_continue": "Continue",
  "contacts_merge_back": "Back",
  "contacts_merge_confirm_title": "Merge these contacts?",
  "contacts_merge_confirm_body": "“{merged}” will be merged into “{survivor}” and archived.",
  "contacts_merge_confirm_moves": "Moving to “{survivor}”: {summary}.",
  "contacts_merge_confirm_override": "{field}: “{before}” will be replaced with “{after}”.",
  "contacts_merge_confirm_irreversible": "This cannot be undone.",
  "contacts_merge_confirm_action": "Merge",
  "contacts_merge_clash_title": "These contacts cannot be merged",
  "contacts_merge_clash_body": "Both have a conversation on “{channel}”. Merging conversations is not supported yet.",
  "contacts_merge_error": "Could not merge the contacts",
  "contacts_merge_error_not_admin": "Only the owner and admins can merge contacts",
  "contacts_merged_toast": "Contacts merged",
  "contacts_archived_merged_into": "Merged into “{name}”",
  "contact_detail_merged_redirect": "This contact was merged into another one",
  "contacts_merge_moves_conversations": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} conversation",
        "countPlural=*": "{count} conversations"
      }
    }
  ],
  "contacts_merge_moves_notes": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} note",
        "countPlural=*": "{count} notes"
      }
    }
  ],
  "contacts_merge_moves_phones": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} phone number",
        "countPlural=*": "{count} phone numbers"
      }
    }
  ],
  "contacts_merge_moves_channels": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "{count} channel",
        "countPlural=*": "{count} channels"
      }
    }
  ],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm i18n:compile && pnpm test src/lib/message-plurals.test.ts src/lib/message-lengths.test.ts`
Expected: PASS.

- [ ] **Step 5: Read the two catalogues against each other**

Nothing checks key parity automatically. Confirm by eye that every id added above exists in **both** files, with the **same** placeholders (`{count}`, `{survivor}`, `{merged}`, `{summary}`, `{field}`, `{before}`, `{after}`, `{channel}`, `{name}`). A placeholder present in one locale and absent in the other compiles and then renders a literal brace to the user.

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/ru.json \
        src/lib/message-plurals.test.ts src/lib/message-lengths.test.ts
git commit -m "$(cat <<'EOF'
i18n(contacts): messages for the duplicate finder and merge

Every counted string is a plural variant with Russian's three forms, and
message-plurals.test.ts pins the expected form per bucket. The picker's
field labels sit in a fixed left column, so they carry width budgets.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Client API and query keys

**Files:**
- Create: `src/features/contacts/api/contact-merges.ts`
- Modify: `src/features/contacts/api/query-keys.ts`
- Modify: `src/features/contacts/api/contacts.ts`
- Modify: `src/entities/contact/model/types.ts`
- Test: `src/features/contacts/api/query-keys.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 1–3's RPCs.
- Produces:
  - `MERGE_FIELD_KEYS`, `MergeFieldKey`, `DuplicateContact`, `DuplicateGroup`, `DuplicateGroupPage`, `DUPLICATE_GROUPS_PAGE_SIZE`, `MergeChildCounts`
  - `listDuplicateContactGroups({ workspaceId, page, pageSize? }): Promise<DuplicateGroupPage>`
  - `countContactMergeChildren({ workspaceId, contactId }): Promise<MergeChildCounts>`
  - `mergeContacts({ survivorId, mergedId, fields }): Promise<void>`
  - `isConversationConflictError(error)`, `isNotAdminError(error)`
  - `contactQueryKeys.duplicates(ws)`, `.duplicatesPage(ws, page)`, `.mergeChildren(ws, contactId)`
  - `ArchivedContact` gains `merged_into_id: string | null`, `merged_into_name: string | null`; `ContactDetail` gains `merged_into_id: string | null`

- [ ] **Step 1: Write the failing test**

Append to `src/features/contacts/api/query-keys.test.ts`:

```ts
describe('duplicate and merge keys', () => {
  it('nests duplicates under the workspace so one workspace never invalidates another', () => {
    expect(contactQueryKeys.duplicatesPage('ws-a', 2)).toEqual([
      'contacts',
      'ws-a',
      'duplicates',
      { page: 2 },
    ])
    // lists() must NOT be a prefix of the duplicates key: the two are served by
    // different RPCs, and a directory invalidation should not refetch a scan.
    expect(contactQueryKeys.duplicates('ws-a')).not.toEqual(
      expect.arrayContaining(['list']),
    )
  })

  it('scopes merge child counts to the contact they describe', () => {
    expect(contactQueryKeys.mergeChildren('ws-a', 'c-1')).toEqual([
      'contacts',
      'ws-a',
      'detail',
      'c-1',
      'merge-children',
    ])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/features/contacts/api/query-keys.test.ts`
Expected: FAIL — `contactQueryKeys.duplicatesPage is not a function`.

- [ ] **Step 3: Add the keys**

In `src/features/contacts/api/query-keys.ts`, add inside the `contactQueryKeys` object, after `archivedList`:

```ts
  /**
   * The duplicates view's own cache, a sibling of `lists` for the same reason
   * `archived` is: a different RPC with a different shape. A directory edit
   * should not refetch a workspace-wide group-by, and a merge invalidates both
   * explicitly rather than relying on one prefix to sweep up the other.
   */
  duplicates: (workspaceId: string) =>
    [...contactQueryKeys.workspace(workspaceId), 'duplicates'] as const,
  duplicatesPage: (workspaceId: string, page: number) =>
    [...contactQueryKeys.duplicates(workspaceId), { page }] as const,
```

and after `phones`:

```ts
  /** What a merge would move off this contact, for the confirmation step. */
  mergeChildren: (workspaceId: string, contactId: string) =>
    [
      ...contactQueryKeys.detail(workspaceId, contactId),
      'merge-children',
    ] as const,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/features/contacts/api/query-keys.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the API module**

Create `src/features/contacts/api/contact-merges.ts`:

```ts
import { callRpc } from '@/utils/supabase-rpc'
import { z } from 'zod'

/**
 * The scalar fields a merge may overwrite on the survivor.
 *
 * The same allowlist exists in `public.merge_contacts`, which raises rather
 * than trusting this one — the client chooses which VALUE wins, never which
 * column. This copy is here so the picker can only build a legal payload.
 */
export const MERGE_FIELD_KEYS = [
  'name',
  'email',
  'owner_id',
  'status',
  'avatar_url',
  'source',
] as const
export type MergeFieldKey = (typeof MERGE_FIELD_KEYS)[number]

export const DUPLICATE_MATCH_REASONS = ['phone', 'channel', 'email'] as const
export type DuplicateMatchReason = (typeof DUPLICATE_MATCH_REASONS)[number]

/**
 * Hand-written rather than taken from the generated `Returns`: these arrive
 * inside a jsonb column, so the generator types the whole thing as `Json` and
 * knows nothing about the fields. Validating here means a shape change fails at
 * the boundary instead of three components later.
 */
const duplicateContactSchema = z.object({
  id: z.string(),
  /** What the row shows: the name, else the earliest channel handle. */
  display_name: z.string().nullable(),
  /** What a merge would write to `contacts.name`. Not the same thing. */
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  status: z.string(),
  source: z.string().nullable(),
  owner_id: z.string().nullable(),
  tags: z.array(z.string()),
  last_seen_at: z.string().nullable(),
  conversation_count: z.number(),
})

export type DuplicateContact = z.infer<typeof duplicateContactSchema>

const duplicateGroupSchema = z.object({
  group_key: z.string(),
  match_reason: z.enum(DUPLICATE_MATCH_REASONS),
  contacts: z.array(duplicateContactSchema),
  contact_count: z.number(),
  total_count: z.number(),
})

export type DuplicateGroup = z.infer<typeof duplicateGroupSchema>

export type DuplicateGroupPage = {
  items: Array<DuplicateGroup>
  totalCount: number
}

/** Kept in step with the RPC's own clamp: least(greatest(p_limit, 1), 50). */
export const DUPLICATE_GROUPS_PAGE_SIZE = 20

export async function listDuplicateContactGroups({
  workspaceId,
  page,
  pageSize = DUPLICATE_GROUPS_PAGE_SIZE,
}: {
  workspaceId: string
  page: number
  pageSize?: number
}): Promise<DuplicateGroupPage> {
  const items = await callRpc(
    'list_duplicate_contact_groups',
    {
      p_workspace_id: workspaceId,
      p_limit: pageSize,
      p_offset: Math.max(page - 1, 0) * pageSize,
    },
    z.array(duplicateGroupSchema),
  )

  // total_count is repeated on every row; no rows means no duplicates.
  return { items, totalCount: items[0]?.total_count ?? 0 }
}

const mergeChildCountsSchema = z.object({
  conversation_count: z.number(),
  note_count: z.number(),
  phone_count: z.number(),
  channel_count: z.number(),
})

export type MergeChildCounts = z.infer<typeof mergeChildCountsSchema>

export async function countContactMergeChildren({
  workspaceId,
  contactId,
}: {
  workspaceId: string
  contactId: string
}): Promise<MergeChildCounts> {
  const rows = await callRpc(
    'count_contact_merge_children',
    { p_workspace_id: workspaceId, p_contact_id: contactId },
    z.array(mergeChildCountsSchema),
  )

  return (
    rows[0] ?? {
      conversation_count: 0,
      note_count: 0,
      phone_count: 0,
      channel_count: 0,
    }
  )
}

export type MergeContactsInput = {
  survivorId: string
  mergedId: string
  /** Only keys in {@link MERGE_FIELD_KEYS}; the RPC raises on anything else. */
  fields: Partial<Record<MergeFieldKey, string | null>>
}

export async function mergeContacts({
  survivorId,
  mergedId,
  fields,
}: MergeContactsInput): Promise<void> {
  // `returns void` arrives as null through PostgREST.
  await callRpc(
    'merge_contacts',
    {
      p_survivor_id: survivorId,
      p_merged_id: mergedId,
      p_fields: fields,
    },
    z.null(),
  )
}

function errorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return ''
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : ''
}

/**
 * The one refusal the dialog can explain rather than merely report: both
 * contacts hold a conversation on the same channel, which
 * `conversations_contact_channel_unique` forbids the survivor from having.
 */
export function isConversationConflictError(error: unknown): boolean {
  return errorMessage(error).includes('CONTACT_MERGE_CONVERSATION_CONFLICT')
}

export function isNotAdminError(error: unknown): boolean {
  return errorMessage(error).includes('NOT_A_WORKSPACE_ADMIN')
}
```

- [ ] **Step 6: Widen the two row types**

In `src/entities/contact/model/types.ts`, add to `ContactDetail`:

```ts
export type ContactDetail = ContactRow & {
  contact_channels: Array<ContactChannelSummary>
}
```

`ContactRow` is `Tables<'contacts'>`, which the regenerated types already give
`merged_into_id`, `merged_at` and `merged_by` — so `ContactDetail` needs no
change **provided** `CONTACT_DETAIL_SELECT` asks for the column. In
`src/features/contacts/api/contacts.ts`, add `merged_into_id,` to
`CONTACT_DETAIL_SELECT` immediately after `deleted_at,`, and widen
`ArchivedContact`:

```ts
export type ArchivedContact = ContactListItem & {
  deleted_at: string
  conversation_count: number
  /**
   * Non-null when the row was merged rather than archived. Such a row is not
   * restorable — `restore_contact` refuses it — so the view shows where it went
   * instead of a button that errors.
   */
  merged_into_id: string | null
  merged_into_name: string | null
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm typecheck && pnpm test src/features/contacts`
Expected: PASS.

```bash
git add src/features/contacts/api/contact-merges.ts \
        src/features/contacts/api/query-keys.ts \
        src/features/contacts/api/query-keys.test.ts \
        src/features/contacts/api/contacts.ts
git commit -m "$(cat <<'EOF'
feat(contacts): client API for the duplicate finder and merge

Zod schemas at the boundary rather than the generated Returns: the group
members arrive inside a jsonb column the generator types as Json, and a
RETURNS TABLE marks every column non-nullable regardless of the truth.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Merge candidate model

**Files:**
- Create: `src/features/contacts/model/merge-candidate.ts`
- Create: `src/features/contacts/model/merge-candidate.test.ts`

**Interfaces:**
- Consumes: `DuplicateContact`, `MergeFieldKey`, `MERGE_FIELD_KEYS` from Task 5; `ContactListItem` from `@/entities/contact`.
- Produces:
  - `type MergeCandidate = { id, displayName, name, phone, email, avatarUrl, status, source, ownerId, tags, lastSeenAt, conversationCount }` — all nullable except `id`, `status`, `tags`, `conversationCount`. `phone` is not mergeable (the merge unions `contact_phones` instead), but the survivor radio needs it to tell two same-named contacts apart.
  - `mergeCandidateFromDuplicate(contact: DuplicateContact): MergeCandidate`
  - `mergeCandidateFromListItem(item: ContactListItem, conversationCount?: number): MergeCandidate`
  - `defaultSurvivorId(a: MergeCandidate, b: MergeCandidate): string`
  - `type MergeConflict = { field: MergeFieldKey; survivorValue: string | null; mergedValue: string | null }`
  - `mergeConflicts(survivor: MergeCandidate, merged: MergeCandidate): Array<MergeConflict>`
  - `mergeFields(survivor, merged, choices: Partial<Record<MergeFieldKey, 'survivor' | 'merged'>>): Partial<Record<MergeFieldKey, string | null>>`

- [ ] **Step 1: Write the failing test**

Create `src/features/contacts/model/merge-candidate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { MergeCandidate } from './merge-candidate'
import {
  defaultSurvivorId,
  mergeConflicts,
  mergeFields,
} from './merge-candidate'

function candidate(patch: Partial<MergeCandidate> = {}): MergeCandidate {
  return {
    id: 'a',
    displayName: 'A',
    name: 'A',
    phone: null,
    email: null,
    avatarUrl: null,
    status: 'new',
    source: null,
    ownerId: null,
    tags: [],
    lastSeenAt: null,
    conversationCount: 0,
    ...patch,
  }
}

describe('defaultSurvivorId', () => {
  it('prefers the contact carrying more history', () => {
    const busy = candidate({ id: 'busy', conversationCount: 4 })
    const quiet = candidate({ id: 'quiet', conversationCount: 1 })
    expect(defaultSurvivorId(quiet, busy)).toBe('busy')
    expect(defaultSurvivorId(busy, quiet)).toBe('busy')
  })

  it('falls back to the most recently seen when history is equal', () => {
    const older = candidate({ id: 'older', lastSeenAt: '2026-01-01T00:00:00Z' })
    const newer = candidate({ id: 'newer', lastSeenAt: '2026-06-01T00:00:00Z' })
    expect(defaultSurvivorId(older, newer)).toBe('newer')
  })

  it('is deterministic when nothing distinguishes them', () => {
    // Two contacts with no history and no last_seen_at must still produce the
    // same default every time the dialog opens, or the pre-selection moves
    // under the user between renders.
    const a = candidate({ id: 'aaa' })
    const b = candidate({ id: 'bbb' })
    expect(defaultSurvivorId(a, b)).toBe(defaultSurvivorId(b, a))
  })
})

describe('mergeConflicts', () => {
  it('reports only fields where both sides hold a different value', () => {
    const survivor = candidate({ id: 's', name: 'Иван', email: 'a@x.ru' })
    const merged = candidate({ id: 'm', name: 'Ivan', email: 'a@x.ru' })

    expect(mergeConflicts(survivor, merged)).toEqual([
      { field: 'name', survivorValue: 'Иван', mergedValue: 'Ivan' },
    ])
  })

  it('is not a conflict when only one side has a value', () => {
    // The merge fills the survivor's empty field from the loser silently: there
    // is no choice to make, and offering one is noise.
    const survivor = candidate({ id: 's', email: null })
    const merged = candidate({ id: 'm', email: 'found@x.ru' })

    expect(mergeConflicts(survivor, merged)).toEqual([])
  })
})

describe('mergeFields', () => {
  it('fills the survivor from the loser where the survivor is empty', () => {
    const survivor = candidate({ id: 's', email: null, ownerId: null })
    const merged = candidate({ id: 'm', email: 'found@x.ru', ownerId: 'u-1' })

    expect(mergeFields(survivor, merged, {})).toEqual({
      email: 'found@x.ru',
      owner_id: 'u-1',
    })
  })

  it('sends only the fields the user actually chose to change', () => {
    const survivor = candidate({ id: 's', name: 'Иван', email: 'a@x.ru' })
    const merged = candidate({ id: 'm', name: 'Ivan', email: 'b@x.ru' })

    // Keeping the survivor's value means sending nothing for that field: the
    // RPC leaves an absent key alone, and an explicit no-op write would be a
    // lie in the audit trail.
    expect(mergeFields(survivor, merged, { name: 'merged', email: 'survivor' })).toEqual({
      name: 'Ivan',
    })
  })

  it('never emits a key outside the RPC allowlist', () => {
    const survivor = candidate({ id: 's' })
    const merged = candidate({ id: 'm', name: 'Other', tags: ['vip'] })

    for (const key of Object.keys(mergeFields(survivor, merged, {}))) {
      expect([
        'name',
        'email',
        'owner_id',
        'status',
        'avatar_url',
        'source',
      ]).toContain(key)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/features/contacts/model/merge-candidate.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the model**

Create `src/features/contacts/model/merge-candidate.ts`:

```ts
import type { ContactListItem } from '@/entities/contact'
import { MERGE_FIELD_KEYS } from '../api/contact-merges'
import type { DuplicateContact, MergeFieldKey } from '../api/contact-merges'

/**
 * One side of a merge, normalized.
 *
 * Two entry points feed the dialog — a duplicate group and a directory
 * multi-select — and they carry different row shapes. Normalizing here keeps
 * the dialog from branching on where it was opened from.
 */
export type MergeCandidate = {
  id: string
  displayName: string | null
  name: string | null
  /**
   * Never merged — the merge unions `contact_phones` and re-syncs the column
   * itself. Carried so the survivor radio can tell two same-named contacts
   * apart, which is exactly the situation a duplicate list puts you in.
   */
  phone: string | null
  email: string | null
  avatarUrl: string | null
  status: string
  source: string | null
  ownerId: string | null
  tags: Array<string>
  lastSeenAt: string | null
  conversationCount: number
}

export function mergeCandidateFromDuplicate(
  contact: DuplicateContact,
): MergeCandidate {
  return {
    id: contact.id,
    displayName: contact.display_name,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    avatarUrl: contact.avatar_url,
    status: contact.status,
    source: contact.source,
    ownerId: contact.owner_id,
    tags: contact.tags,
    lastSeenAt: contact.last_seen_at,
    conversationCount: contact.conversation_count,
  }
}

export function mergeCandidateFromListItem(
  item: ContactListItem,
  conversationCount = 0,
): MergeCandidate {
  return {
    id: item.id,
    displayName: item.display_name,
    name: item.name,
    phone: item.phone,
    email: item.email,
    avatarUrl: item.avatar_url,
    status: item.status,
    source: item.source,
    ownerId: item.owner_id,
    tags: item.tags,
    lastSeenAt: item.last_seen_at,
    conversationCount,
  }
}

/**
 * Which contact the dialog pre-selects to keep.
 *
 * The one carrying more history, because moving fewer conversations is the
 * smaller change; then the more recently seen; then the lower id, which decides
 * nothing on the merits but makes the pre-selection stable. Two contacts with
 * no history and no last_seen_at must not swap places between renders.
 */
export function defaultSurvivorId(a: MergeCandidate, b: MergeCandidate): string {
  if (a.conversationCount !== b.conversationCount) {
    return a.conversationCount > b.conversationCount ? a.id : b.id
  }

  const aSeen = a.lastSeenAt ?? ''
  const bSeen = b.lastSeenAt ?? ''
  if (aSeen !== bSeen) return aSeen > bSeen ? a.id : b.id

  return a.id < b.id ? a.id : b.id
}

export type MergeConflict = {
  field: MergeFieldKey
  survivorValue: string | null
  mergedValue: string | null
}

const FIELD_READERS: Record<
  MergeFieldKey,
  (candidate: MergeCandidate) => string | null
> = {
  name: (c) => c.name,
  email: (c) => c.email,
  owner_id: (c) => c.ownerId,
  status: (c) => c.status,
  avatar_url: (c) => c.avatarUrl,
  source: (c) => c.source,
}

function normalize(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Fields where both sides hold a value and the values differ.
 *
 * A field set on only one side is NOT a conflict: the merge fills the
 * survivor's blank from the loser, which is what anyone would expect and which
 * offering a choice would only obscure.
 */
export function mergeConflicts(
  survivor: MergeCandidate,
  merged: MergeCandidate,
): Array<MergeConflict> {
  const conflicts: Array<MergeConflict> = []

  for (const field of MERGE_FIELD_KEYS) {
    const survivorValue = normalize(FIELD_READERS[field](survivor))
    const mergedValue = normalize(FIELD_READERS[field](merged))

    if (survivorValue === null || mergedValue === null) continue
    if (survivorValue === mergedValue) continue

    conflicts.push({ field, survivorValue, mergedValue })
  }

  return conflicts
}

/**
 * The `p_fields` payload for one resolved merge.
 *
 * Only fields that actually change are emitted. `merge_contacts` leaves an
 * absent key alone, so keeping the survivor's value means sending nothing —
 * writing it back explicitly would bump updated_at over a no-op.
 */
export function mergeFields(
  survivor: MergeCandidate,
  merged: MergeCandidate,
  choices: Partial<Record<MergeFieldKey, 'survivor' | 'merged'>>,
): Partial<Record<MergeFieldKey, string | null>> {
  const fields: Partial<Record<MergeFieldKey, string | null>> = {}

  for (const field of MERGE_FIELD_KEYS) {
    const survivorValue = normalize(FIELD_READERS[field](survivor))
    const mergedValue = normalize(FIELD_READERS[field](merged))

    if (mergedValue === null) continue
    if (survivorValue === mergedValue) continue

    // Blank on the survivor: filled silently, no choice was offered.
    if (survivorValue === null) {
      fields[field] = mergedValue
      continue
    }

    if (choices[field] === 'merged') fields[field] = mergedValue
  }

  return fields
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/features/contacts/model/merge-candidate.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/contacts/model/merge-candidate.ts \
        src/features/contacts/model/merge-candidate.test.ts
git commit -m "$(cat <<'EOF'
feat(contacts): normalize the two sides of a merge

One MergeCandidate shape for both entry points, plus the conflict rules:
a field set on only one side is filled silently rather than offered as a
choice, and keeping the survivor's value emits nothing so the RPC leaves
the column alone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Query hooks

**Files:**
- Create: `src/features/contacts/hooks/use-contact-merges.ts`

**Interfaces:**
- Consumes: Task 5's API module and query keys.
- Produces:
  - `useDuplicateContactGroups({ workspaceId, page, enabled })`
  - `useContactMergeChildren(workspaceId, contactId, enabled)`
  - `useMergeContacts(workspaceId)` — a mutation taking `MergeContactsInput`

- [ ] **Step 1: Write the hooks**

No separate failing test: these are thin wrappers whose behaviour is exercised by Tasks 8–9's component tests, and the repo does not unit-test its other query hooks of this shape (`useContactPhones`, `useContactConversations`). The invalidation set, which is the only real logic here, is asserted in Task 9.

Create `src/features/contacts/hooks/use-contact-merges.ts`:

```ts
import { attentionQueueQueryKeys } from '@/features/dashboard/api/attention-queue'
import { homeStatsQueryKeys } from '@/features/dashboard/api/home-stats'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countContactMergeChildren,
  listDuplicateContactGroups,
  mergeContacts,
} from '../api/contact-merges'
import type { MergeContactsInput } from '../api/contact-merges'
import { contactQueryKeys } from '../api/query-keys'

/**
 * The duplicates view's page.
 *
 * `staleTime` is deliberate: behind this is a group-by over every live contact
 * in the workspace, not a point lookup. It is cheap enough to open, and far too
 * expensive to refetch on every window focus.
 */
export function useDuplicateContactGroups({
  workspaceId,
  page,
  enabled,
}: {
  workspaceId: string
  page: number
  enabled: boolean
}) {
  return useQuery({
    queryKey: contactQueryKeys.duplicatesPage(workspaceId, page),
    queryFn: () => listDuplicateContactGroups({ workspaceId, page }),
    enabled: enabled && Boolean(workspaceId),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}

/**
 * What a merge would move off one contact. Fetched only while the dialog is
 * open — `enabled` is the dialog's own state — because the confirmation is the
 * only thing that needs it.
 */
export function useContactMergeChildren(
  workspaceId: string,
  contactId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: contactQueryKeys.mergeChildren(workspaceId, contactId),
    queryFn: () => countContactMergeChildren({ workspaceId, contactId }),
    enabled: enabled && Boolean(workspaceId && contactId),
  })
}

/**
 * Merge two contacts.
 *
 * The invalidation is wider than this feature's usual, and deliberately: a
 * merge moves conversations between contacts, so the inbox is as stale as the
 * directory. Everything under the workspace's contact keys goes — directory
 * pages, the archive, the duplicates scan, both details, and the identity
 * lookups a shared-contact card reads.
 */
export function useMergeContacts(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MergeContactsInput) => mergeContacts(input),

    onSuccess: (_result, input) => {
      // Dropped rather than invalidated: the merged contact is now invisible to
      // this caller's SELECT policy, so a refetch resolves to null and renders
      // the not-found state on a route that may be navigating away.
      queryClient.removeQueries({
        queryKey: contactQueryKeys.detail(workspaceId, input.mergedId),
      })

      const keys = [
        contactQueryKeys.workspace(workspaceId),
        inboxQueryKeys.conversations(workspaceId),
        inboxQueryKeys.conversationSearchAll(workspaceId),
        inboxQueryKeys.unreadCountsForWorkspace(workspaceId),
        attentionQueueQueryKeys.all,
        homeStatsQueryKeys.all,
      ]

      for (const queryKey of keys) {
        void queryClient.invalidateQueries({ queryKey })
      }
    },
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. If `inboxQueryKeys.conversationSearchAll` or
`unreadCountsForWorkspace` do not exist under those names, read
`src/features/inbox/api/query-keys.ts` and use the names it actually exports —
`use-contacts.ts`'s `invalidateArchiveSurfaces` uses the same set and is the
reference.

- [ ] **Step 3: Commit**

```bash
git add src/features/contacts/hooks/use-contact-merges.ts
git commit -m "$(cat <<'EOF'
feat(contacts): query hooks for duplicates and merge

A merge moves conversations between contacts, so it invalidates the inbox
and the dashboard alongside every contact surface. The duplicates scan
carries a staleTime: it is a workspace-wide group-by, not a point lookup.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: The merge dialog

**Files:**
- Create: `src/features/contacts/ui/merge-contacts-dialog.tsx`
- Create: `src/features/contacts/ui/merge-contacts-dialog.test.tsx`

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces: `<MergeContactsDialog workspaceId contacts={[MergeCandidate, MergeCandidate] | null} onOpenChange onMerged />`. `contacts === null` closes it. `onMerged` fires after a successful merge, for the caller to clear its selection.

Astryx forbids nesting dialogs — "restructure the flow into steps within a single dialog instead" — so this is one `Dialog` with two internal steps, not a `Dialog` plus an `AlertDialog`.

- [ ] **Step 1: Write the failing test**

Create `src/features/contacts/ui/merge-contacts-dialog.test.tsx`. Follow the render/provider setup used by `src/features/contact-notes/ui/contact-notes-section.test.tsx` — read that file first and mirror its `QueryClientProvider` + Astryx wrapper.

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MergeCandidate } from '../model/merge-candidate'
import { MergeContactsDialog } from './merge-contacts-dialog'

const merge = vi.fn()
const childCounts = vi.fn()

vi.mock('../hooks/use-contact-merges', () => ({
  useMergeContacts: () => ({ mutate: merge, isPending: false }),
  useContactMergeChildren: () => ({ data: childCounts() }),
}))

function candidate(patch: Partial<MergeCandidate>): MergeCandidate {
  return {
    id: 'a',
    displayName: 'A',
    name: 'A',
    phone: null,
    email: null,
    avatarUrl: null,
    status: 'new',
    source: null,
    ownerId: null,
    tags: [],
    lastSeenAt: null,
    conversationCount: 0,
    ...patch,
  }
}

function renderDialog(pair: [MergeCandidate, MergeCandidate]) {
  childCounts.mockReturnValue({
    conversation_count: 2,
    note_count: 1,
    phone_count: 3,
    channel_count: 1,
  })

  return render(
    <MergeContactsDialog
      workspaceId="ws-1"
      contacts={pair}
      onOpenChange={() => {}}
      onMerged={() => {}}
    />,
  )
}

describe('MergeContactsDialog', () => {
  it('offers a choice only for fields that actually disagree', () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван', email: 'x@y.ru' }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan', email: null }),
    ])

    // name differs on both sides -> a choice.
    expect(screen.getByRole('radiogroup', { name: /Имя|Name/ })).toBeVisible()
    // email exists on one side only -> filled silently, no control.
    expect(
      screen.queryByRole('radiogroup', { name: /Email/ }),
    ).not.toBeInTheDocument()
  })

  it('does not commit from the first step', async () => {
    const user = userEvent.setup()
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван' }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan' }),
    ])

    await user.click(screen.getByRole('button', { name: /Продолжить|Continue/ }))
    expect(merge).not.toHaveBeenCalled()

    // The second step states the consequence before the destructive action.
    expect(
      screen.getByText(/нельзя отменить|cannot be undone/),
    ).toBeVisible()
  })

  it('merges with the resolved field payload once confirmed', async () => {
    const user = userEvent.setup()
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван', conversationCount: 5 }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan', conversationCount: 1 }),
    ])

    await user.click(screen.getByRole('button', { name: /Продолжить|Continue/ }))
    await user.click(screen.getByRole('button', { name: /^Объединить$|^Merge$/ }))

    await waitFor(() => expect(merge).toHaveBeenCalledTimes(1))
    // 'a' carries more history, so it is the default survivor and 'b' is merged
    // into it. No field was switched, so nothing is overwritten.
    expect(merge.mock.calls[0][0]).toEqual({
      survivorId: 'a',
      mergedId: 'b',
      fields: {},
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/features/contacts/ui/merge-contacts-dialog.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Write the component**

Create `src/features/contacts/ui/merge-contacts-dialog.tsx`:

```tsx
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { useToast } from '@astryxdesign/core/Toast'
import { useMemo, useState } from 'react'
import type { MergeFieldKey } from '../api/contact-merges'
import {
  isConversationConflictError,
  isNotAdminError,
} from '../api/contact-merges'
import {
  useContactMergeChildren,
  useMergeContacts,
} from '../hooks/use-contact-merges'
import type { MergeCandidate } from '../model/merge-candidate'
import {
  defaultSurvivorId,
  mergeConflicts,
  mergeFields,
} from '../model/merge-candidate'

const FIELD_LABELS: Record<MergeFieldKey, () => string> = {
  name: () => m.contacts_merge_field_name(),
  email: () => m.contacts_merge_field_email(),
  owner_id: () => m.contacts_merge_field_owner(),
  status: () => m.contacts_merge_field_status(),
  avatar_url: () => m.contacts_merge_field_avatar(),
  source: () => m.contacts_merge_field_source(),
}

type Props = {
  workspaceId: string
  /** Null closes the dialog; a pair opens it for those two contacts. */
  contacts: [MergeCandidate, MergeCandidate] | null
  onOpenChange: (open: boolean) => void
  /** Fired after a successful merge, for the caller to clear its selection. */
  onMerged: () => void
}

function candidateLabel(candidate: MergeCandidate): string {
  return candidate.displayName?.trim() || m.contacts_merge_value_empty()
}

/**
 * Choose, then commit.
 *
 * One dialog with two steps rather than a confirmation layered over a picker:
 * Astryx's Dialog guidance is explicit that dialogs must not nest, and
 * AlertDialog takes a plain string description and could not hold the picker
 * anyway. The separation that matters — deciding and committing are different
 * acts — survives as two steps inside one surface.
 *
 * `purpose="form"` because a backdrop click must not discard a half-made
 * choice.
 */
export function MergeContactsDialog({
  workspaceId,
  contacts,
  onOpenChange,
  onMerged,
}: Props) {
  const showToast = useToast()
  const merge = useMergeContacts(workspaceId)

  const [survivorId, setSurvivorId] = useState<string | null>(null)
  const [choices, setChoices] = useState<
    Partial<Record<MergeFieldKey, 'survivor' | 'merged'>>
  >({})
  const [isConfirming, setIsConfirming] = useState(false)
  const [conflictError, setConflictError] = useState(false)

  // Derived rather than stored, so reopening the dialog on a different pair
  // cannot leave the previous pair's survivor selected.
  const pairKey = contacts ? `${contacts[0].id}:${contacts[1].id}` : null
  const [seenPairKey, setSeenPairKey] = useState<string | null>(null)
  if (pairKey !== seenPairKey) {
    setSeenPairKey(pairKey)
    setSurvivorId(contacts ? defaultSurvivorId(contacts[0], contacts[1]) : null)
    setChoices({})
    setIsConfirming(false)
    setConflictError(false)
  }

  const survivor = contacts?.find((c) => c.id === survivorId) ?? null
  const merged = contacts?.find((c) => c.id !== survivorId) ?? null

  const children = useContactMergeChildren(
    workspaceId,
    merged?.id ?? '',
    contacts !== null,
  )

  const conflicts = useMemo(
    () => (survivor && merged ? mergeConflicts(survivor, merged) : []),
    [survivor, merged],
  )

  const fields = useMemo(
    () => (survivor && merged ? mergeFields(survivor, merged, choices) : {}),
    [survivor, merged, choices],
  )

  if (!contacts || !survivor || !merged) return null

  // Only what the picker actually overwrites — a field the survivor had blank
  // is filled, not replaced, and calling that destruction would be theatre.
  const overrides = conflicts.filter((conflict) => choices[conflict.field] === 'merged')

  const counts = children.data
  const movesSummary = counts
    ? [
        counts.conversation_count > 0 &&
          m.contacts_merge_moves_conversations({ count: counts.conversation_count }),
        counts.phone_count > 0 &&
          m.contacts_merge_moves_phones({ count: counts.phone_count }),
        counts.channel_count > 0 &&
          m.contacts_merge_moves_channels({ count: counts.channel_count }),
        counts.note_count > 0 &&
          m.contacts_merge_moves_notes({ count: counts.note_count }),
      ]
        .filter((part): part is string => typeof part === 'string')
        .join(' · ')
    : ''

  function confirmMerge() {
    if (merge.isPending || !survivor || !merged) return

    merge.mutate(
      { survivorId: survivor.id, mergedId: merged.id, fields },
      {
        onError: (error) => {
          if (isConversationConflictError(error)) {
            setConflictError(true)
            setIsConfirming(false)
            return
          }
          showToast({
            body: isNotAdminError(error)
              ? m.contacts_merge_error_not_admin()
              : m.contacts_merge_error(),
            type: 'error',
          })
          onOpenChange(false)
        },
        onSuccess: () => {
          showToast({ body: m.contacts_merged_toast(), type: 'info' })
          onOpenChange(false)
          onMerged()
        },
      },
    )
  }

  return (
    <Dialog
      isOpen
      onOpenChange={onOpenChange}
      purpose="form"
      width={560}
    >
      <DialogHeader
        title={
          isConfirming
            ? m.contacts_merge_confirm_title()
            : m.contacts_merge_title()
        }
        subtitle={isConfirming ? undefined : m.contacts_merge_subtitle()}
        onOpenChange={onOpenChange}
        startContent={
          isConfirming ? (
            <Button
              label={m.contacts_merge_back()}
              variant="ghost"
              size="sm"
              onClick={() => setIsConfirming(false)}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 px-4 py-4">
        {conflictError ? (
          <Banner
            status="error"
            title={m.contacts_merge_clash_title()}
            description={m.contacts_merge_clash_body({
              channel: candidateLabel(merged),
            })}
          />
        ) : isConfirming ? (
          <>
            <Banner
              status="error"
              title={m.contacts_merge_confirm_irreversible()}
              description={m.contacts_merge_confirm_body({
                merged: candidateLabel(merged),
                survivor: candidateLabel(survivor),
              })}
            />

            {movesSummary ? (
              <p className="text-secondary text-xs">
                {m.contacts_merge_confirm_moves({
                  survivor: candidateLabel(survivor),
                  summary: movesSummary,
                })}
              </p>
            ) : null}

            {/* Omitted entirely when nothing is overwritten: inventing danger
                where there is none teaches people to click through it. */}
            {overrides.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {overrides.map((override) => (
                  <li key={override.field} className="text-primary text-xs">
                    {m.contacts_merge_confirm_override({
                      field: FIELD_LABELS[override.field](),
                      before: override.survivorValue ?? '',
                      after: override.mergedValue ?? '',
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <>
            <RadioList
              label={m.contacts_merge_keep_label()}
              value={survivor.id}
              onChange={setSurvivorId}
            >
              {contacts.map((candidate) => (
                <RadioListItem
                  key={candidate.id}
                  value={candidate.id}
                  label={candidateLabel(candidate)}
                  // Two duplicates very often share a name — that is why they
                  // are in this list — so the radio needs something else to
                  // tell them apart.
                  description={candidate.phone ?? candidate.email ?? undefined}
                  startContent={
                    <Avatar
                      size="sm"
                      name={candidateLabel(candidate)}
                      src={candidate.avatarUrl ?? undefined}
                    />
                  }
                />
              ))}
            </RadioList>

            {conflicts.length === 0 ? (
              <p className="text-secondary text-xs">
                {m.contacts_merge_no_conflicts()}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {conflicts.map((conflict) => (
                  <RadioList
                    key={conflict.field}
                    label={FIELD_LABELS[conflict.field]()}
                    orientation="horizontal"
                    size="sm"
                    value={choices[conflict.field] ?? 'survivor'}
                    onChange={(value) =>
                      setChoices((current) => ({
                        ...current,
                        [conflict.field]: value === 'merged' ? 'merged' : 'survivor',
                      }))
                    }
                  >
                    <RadioListItem
                      value="survivor"
                      label={conflict.survivorValue ?? m.contacts_merge_value_empty()}
                    />
                    <RadioListItem
                      value="merged"
                      label={conflict.mergedValue ?? m.contacts_merge_value_empty()}
                    />
                  </RadioList>
                ))}
              </div>
            )}

            <p className={cn('text-secondary text-xs')}>
              {m.contacts_merge_always_kept()}
            </p>
          </>
        )}
      </div>

      <div className="border-border flex shrink-0 justify-end gap-2 border-t px-4 py-3">
        <Button
          label={m.common_cancel()}
          variant="ghost"
          onClick={() => onOpenChange(false)}
        />
        {conflictError ? null : isConfirming ? (
          <Button
            label={m.contacts_merge_confirm_action()}
            variant="destructive"
            onClick={confirmMerge}
            isLoading={merge.isPending}
          />
        ) : (
          <Button
            label={m.contacts_merge_continue()}
            variant="primary"
            onClick={() => setIsConfirming(true)}
          />
        )}
      </div>
    </Dialog>
  )
}
```

**Note for the implementer:** the `RadioList`, `RadioListItem`, `Banner`,
`Dialog` and `DialogHeader` props used above were read from `pnpm exec astryx
component <Name>` against `@astryxdesign/core@0.1.8`. Re-run those commands and
confirm before writing; do not guess a prop, and do not add a compatibility shim
if one has moved.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/features/contacts/ui/merge-contacts-dialog.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/contacts/ui/merge-contacts-dialog.tsx \
        src/features/contacts/ui/merge-contacts-dialog.test.tsx \
        src/features/contacts/model/merge-candidate.ts \
        src/features/contacts/model/merge-candidate.test.ts
git commit -m "$(cat <<'EOF'
feat(contacts): two-step merge dialog

One Dialog with a picker step and a confirmation step. Astryx forbids
nesting dialogs and AlertDialog cannot hold a picker, so the separation
between deciding and committing is two steps inside one surface.

The confirmation states the real consequence: what moves, and which of
the survivor's fields the picker overwrites. The override paragraph is
omitted when nothing is overwritten -- manufactured danger teaches people
to click through the real kind.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Duplicates view, directory selection, and the page split

**Files:**
- Create: `src/features/contacts/ui/duplicate-group-card.tsx`
- Create: `src/features/contacts/ui/duplicates-view.tsx`
- Create: `src/features/contacts/ui/directory-view.tsx`
- Create: `src/features/contacts/ui/archived-view.tsx`
- Modify: `src/features/contacts/ui/contacts-page.tsx`
- Modify: `src/features/contacts/model/contact-list-params.ts`
- Modify: `src/routes/_authenticated/workspaces/$id/contacts.tsx`
- Modify: `src/routes/_authenticated/workspaces/$id/contacts/index.tsx`
- Modify: `src/features/contacts/index.ts`

**Interfaces:**
- Consumes: Tasks 4–8.
- Produces: `ContactListPatch` gains `duplicates?: boolean`. The contacts search schema gains `duplicates: boolean` (default `false`). `ContactsPage` gains an `isDuplicates: boolean` prop.

- [ ] **Step 1: Add the search parameter**

In `src/features/contacts/model/contact-list-params.ts`, extend the patch type:

```ts
export type ContactListPatch = Partial<ContactListParams> & {
  archived?: boolean
  /**
   * The duplicates view. A sibling of `archived` for the same reason: it
   * selects a different RPC rather than parameterising the directory's, so it
   * has no field in `ContactListParams`.
   */
  duplicates?: boolean
}
```

In `src/routes/_authenticated/workspaces/$id/contacts.tsx`, add `duplicates: false` to `defaults`, `duplicates: withDefault(z.boolean(), defaults.duplicates)` to `contactsSearchSchema`, and `'duplicates'` to the `retainSearchParams` list.

In `src/routes/_authenticated/workspaces/$id/contacts/index.tsx`, add
`isDuplicates={search.duplicates}` to `<ContactsPage>` and
`duplicates: patch.duplicates ?? search.duplicates,` to the `search` object in
`onParamsChange`.

- [ ] **Step 2: Write the duplicate group card**

Create `src/features/contacts/ui/duplicate-group-card.tsx`:

```tsx
import { listItemStyle } from '@/components/list'
import { ContactStatusChip, isContactStatus } from '@/entities/contact'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@tanstack/react-router'
import type {
  DuplicateGroup,
  DuplicateMatchReason,
} from '../api/contact-merges'

const REASON_LABELS: Record<DuplicateMatchReason, () => string> = {
  phone: () => m.contacts_duplicates_reason_phone(),
  channel: () => m.contacts_duplicates_reason_channel(),
  email: () => m.contacts_duplicates_reason_email(),
}

type Props = {
  group: DuplicateGroup
  workspaceId: string
  /** Owner/admin only: the RPC behind the action refuses anyone else. */
  canMerge: boolean
  onMerge: () => void
}

/**
 * One set of contacts that share an identity key.
 *
 * Not Card-wrapped: `DESIGN.md` reserves cards, and a group is a small stack of
 * list rows under a header, inside a pane that is already the containing
 * surface.
 */
export function DuplicateGroupCard({
  group,
  workspaceId,
  canMerge,
  onMerge,
}: Props) {
  return (
    <li className="border-border flex flex-col gap-1 border-b px-2 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-primary text-xs font-medium">
            {REASON_LABELS[group.match_reason]()}
          </span>
          <span className="text-secondary shrink-0 text-xs tabular-nums">
            {m.contacts_duplicates_group_size({ count: group.contact_count })}
          </span>
        </div>
        {canMerge ? (
          <Button
            label={m.contacts_duplicates_merge_action()}
            size="sm"
            variant="secondary"
            // Exactly two at a time: the picker is a two-column comparison.
            isDisabled={group.contact_count !== 2}
            onClick={onMerge}
          />
        ) : null}
      </div>

      <ul className="flex flex-col gap-0.5">
        {group.contacts.map((contact) => (
          <li
            key={contact.id}
            className={cn(
              'relative flex items-center gap-3',
              listItemStyle.md,
              'px-3 py-2',
              listItemStyle.transition,
              'hover:bg-primary/4 focus-within:bg-primary/4',
            )}
          >
            <Avatar
              size="sm"
              name={contact.display_name ?? ''}
              src={contact.avatar_url ?? undefined}
            />
            <div className="min-w-0 flex-1">
              <Link
                to="/workspaces/$id/contacts/$contactId"
                params={{ id: workspaceId, contactId: contact.id }}
                className={cn(
                  'text-primary block truncate text-base font-medium outline-none',
                  'after:absolute after:inset-0 after:rounded-lg after:content-[""]',
                  'focus-visible:after:ring-accent focus-visible:after:ring-2 focus-visible:after:ring-inset',
                )}
              >
                {contact.display_name ?? m.contacts_unnamed()}
              </Link>
              {contact.phone || contact.email ? (
                <p className="text-secondary truncate text-xs">
                  {contact.phone ?? contact.email}
                </p>
              ) : null}
            </div>
            {isContactStatus(contact.status) ? (
              <ContactStatusChip status={contact.status} />
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  )
}
```

`m.contacts_unnamed()` must already exist — `contactListDisplayName` in
`src/entities/contact` handles the null case for the directory. Reuse that
helper instead of a new message if it is what the directory uses; read
`src/entities/contact/lib/contact-display-name.ts` and match it.

- [ ] **Step 3: Write the duplicates view**

Create `src/features/contacts/ui/duplicates-view.tsx` with the same
pending / error / empty / list / pagination structure `contacts-page.tsx`
already uses for the archived view — `ContactListSkeleton` while pending, the
`bg-error/10` retry strip on error, an `EmptyState` with `UsersRoundIcon` when
there are no groups, and `Pagination` when `totalCount > DUPLICATE_GROUPS_PAGE_SIZE`.
It owns the `MergeContactsDialog` for the pair the user picked:

```tsx
const [pair, setPair] = useState<[MergeCandidate, MergeCandidate] | null>(null)
```

and opens it with
`setPair([mergeCandidateFromDuplicate(group.contacts[0]), mergeCandidateFromDuplicate(group.contacts[1])])`.
On `onMerged`, clear the pair.

- [ ] **Step 4: Extract the directory and archived views, add selection**

Move the live-directory branch of `contacts-page.tsx` into `directory-view.tsx`
and the archived branch into `archived-view.tsx`, unchanged in behaviour. Then
add multi-select to `directory-view.tsx`:

- `const [selected, setSelected] = useState<Array<string>>([])`, capped at two —
  selecting a third replaces the oldest, so the control never enters a state the
  dialog cannot open.
- Render a checkbox per row only when `canMerge` (owner/admin).
- A sticky bar above the list when `selected.length > 0`, showing
  `m.contacts_merge_selected({ count: selected.length })`, a Merge button
  enabled only at exactly two, `m.contacts_merge_selection_hint()` below two,
  and a clear action.
- Merging uses `mergeCandidateFromListItem(item, 0)`; conversation counts are
  not in `ContactListItem`, and `defaultSurvivorId` falls through to
  `lastSeenAt`, which it does carry.

`contacts-page.tsx` keeps the header, the filter row (now with a third chip for
duplicates beside Архив, admin-visible like Архив is), and the switch between
the three views. It must end up substantially shorter than its current 432
lines.

- [ ] **Step 5: Export the new surface**

Add `MergeContactsDialog`, `DuplicatesView` and the merge model helpers to
`src/features/contacts/index.ts` only if a route or another feature imports
them. Internal-only components stay unexported — the index is a public API, not
a barrel of everything.

- [ ] **Step 6: Run the checks**

Run: `pnpm typecheck && pnpm test src/features/contacts && pnpm lint`
Expected: PASS. `src/routeTree.gen.ts` regenerates itself through the Vite
plugin; do not hand-edit it, and commit it if it changed.

- [ ] **Step 7: Commit**

```bash
git add src/features/contacts src/routes/_authenticated/workspaces/\$id/contacts.tsx \
        src/routes/_authenticated/workspaces/\$id/contacts/index.tsx \
        src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat(contacts): duplicates view and directory multi-select

A third directory view driven by list_duplicate_contact_groups, plus
two-at-a-time selection in the live directory. Both open the same merge
dialog. The Merge action is owner/admin only, matching the RPC; the view
itself is visible to every member so a duplicate can be reported.

contacts-page.tsx is split into directory, archived and duplicates views;
it was 432 lines and this change would have added a third branch and
selection state to it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Merged rows in the archive, and the detail redirect

**Files:**
- Modify: `src/features/contacts/ui/archived-contact-row.tsx`
- Modify: `src/features/contacts/ui/contact-detail-page.tsx`

**Interfaces:**
- Consumes: Task 1's `merged_into_id` / `merged_into_name`, Task 5's widened `ArchivedContact`.
- Produces: no new exports.

- [ ] **Step 1: Merged rows say where they went**

In `archived-contact-row.tsx`, when `contact.merged_into_id !== null`:
- render `m.contacts_archived_merged_into({ name: contact.merged_into_name ?? '' })` in place of the archived-at line
- render **no** Restore button. `restore_contact` refuses a merged contact with
  `CONTACT_IS_MERGED`, so a button there is a button that errors.

- [ ] **Step 2: The detail route redirects**

In `contact-detail-page.tsx`, once the detail query resolves with a non-null
`merged_into_id`, navigate to the survivor and show an info toast:

```tsx
useEffect(() => {
  const mergedInto = contactQuery.data?.merged_into_id
  if (!mergedInto) return

  showToast({ body: m.contact_detail_merged_redirect(), type: 'info' })
  void navigate({
    to: '/workspaces/$id/contacts/$contactId',
    params: { id: workspaceId, contactId: mergedInto },
    // Replace, not push: the merged id is gone for good and must not sit in
    // history for the back button to return to.
    replace: true,
  })
}, [contactQuery.data?.merged_into_id])
```

One hop only. `merge_contacts` refuses a contact that already carries a
`merged_into_id`, so the survivor cannot itself be merged and there is no chain
to walk. If the survivor has since been archived by ordinary means, the detail
query returns null and the existing not-found state renders — no worse than
opening any other archived contact by id.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm test src/features/contacts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/contacts/ui/archived-contact-row.tsx \
        src/features/contacts/ui/contact-detail-page.tsx
git commit -m "$(cat <<'EOF'
feat(contacts): merged rows say where they went, and old URLs redirect

An archived row that was merged names its survivor and drops Restore --
restore_contact refuses it, so the button could only ever error. A merged
contact's detail URL redirects to the survivor with replace, so a stale
link or bookmark lands somewhere true.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Full verification and the browser pass

**Files:** none — this task changes nothing unless it finds something.

- [ ] **Step 1: Run the full suite**

Run: `pnpm verify`
Expected: typecheck, lint, test and build all pass. It stops at the first
failure; fix and re-run.

- [ ] **Step 2: Run the database suite**

Run: `pnpm test:db`
Expected: every file green, including the ones this work did not touch.
Coordinate first — local Supabase is one shared instance for the machine.

- [ ] **Step 3: Check it in a real browser, in Russian, at phone width**

Run: `pnpm dev` and sign in with the shared test account from `AGENTS.md`
(`ncase01@gmail.com` / `123456789`). jsdom has no layout, so nothing below is
covered by any test above.

Walk through, with the locale set to Russian and the viewport at 375px:

1. Contacts → the Дубликаты chip appears for an admin and carries a count.
2. A duplicate group renders its reason, its size and its members without
   overflowing the pane.
3. Merge opens the dialog; the picker's field labels do not truncate in the left
   column, and long Russian names truncate rather than widening the dialog.
4. Continue reaches the confirmation; the destructive banner reads correctly and
   the override lines name real values.
5. Merge succeeds; the toast appears, the directory drops a row, and the
   survivor's detail shows the moved conversations and notes.
6. Opening the merged contact's old URL redirects to the survivor.
7. The Архив view shows the merged row with "Объединён с …" and no Restore.
8. Switch to English and confirm nothing overflows there either.

- [ ] **Step 4: Open the pull request**

```bash
pnpm worktree:finish
```

It refuses on a dirty tree, a detached HEAD, a branch sitting on `main`, or a
branch with no commits beyond `origin/main`. It will not commit for you. Re-run
after later commits to update the same PR.

---

## Self-Review

Run against the spec after the plan is written; findings fixed inline.

**Spec coverage** — §4.1 columns → Task 1. §4.2 collision table → Task 2 steps 6–7. §4.3 clash refusal → Task 2. §5 destruction table → Task 8's confirmation. §6.1 `merge_contacts` → Task 2. §6.2 `restore_contact` and `list_archived_contacts` → Task 1. §6.3 duplicate finder → Task 3. §7.1 files → the File Structure table. §7.2 duplicates view → Task 9. §7.3 dialog → Task 8. §7.4 redirect and invalidation → Tasks 10 and 7. §8 errors → Task 5's predicates and Task 8's `onError`. §9 i18n → Task 4. §10 tests → Tasks 1–3, 6, 8, 11. §11 risks → carried as comments in the code they describe.

**Gaps found and closed** — the spec's §10 said an out-of-allowlist `p_fields` key "changes nothing"; the implementation raises `CONTACT_MERGE_UNKNOWN_FIELD` instead, which is stricter and easier to test, and the spec is corrected to match. The spec did not name a source for the counts in the confirmation, so `count_contact_merge_children` was added to Task 3 and the spec's §6.3 lists it.

**Type consistency** — a first pass had Task 8's dialog reading `candidate.phoneLabel`, a property no task defines, and had `mergeCandidateFromDuplicate` reading `contact.name` from an RPC payload that returned only `display_name`. Both are fixed at the source: `MergeCandidate` carries `phone`, `list_duplicate_contact_groups` returns `name` *and* `display_name` (they differ whenever a contact borrowed a channel handle, and merging the handle into `contacts.name` would invent a name nobody typed), and every `candidate()` fixture in Tasks 6 and 8 lists the same fields as the type.

**Deviation from the spec, recorded** — the spec's §7.3 originally layered an `AlertDialog` over the picker. `pnpm exec astryx component Dialog` says plainly: "Don't: Nest dialogs inside other dialogs; restructure the flow into steps within a single dialog instead." The spec was amended to one dialog with two steps before this plan was written, and Task 8 implements the amended version.
