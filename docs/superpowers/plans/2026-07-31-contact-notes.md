# Contact Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver secure, localized, multi-note contact context inside the existing inbox contact panel, including author attribution, inline editing, collaborative pinning, confirmed deletion, and robust failure handling.

**Architecture:** Add a workspace-scoped `contact_notes` Supabase table with database-derived ownership and contact scoping. Represent note rows and ordering in `entities/contact-note`; keep Supabase APIs, scoped TanStack Query hooks, localized schemas, and workflow UI in `features/contact-notes`; compose the feature from the existing contact panel without changing routes.

**Tech Stack:** PostgreSQL/Supabase RLS and pgTAP, generated Supabase TypeScript types, React 19, TypeScript, TanStack Query, React Hook Form, Zod 4, Paraglide/Inlang, Astryx, Tailwind CSS 4, Vitest, Testing Library.

---

## File map

### Database

- Create through `pnpm exec supabase migration new create_contact_notes`, then normalize the CLI-created filename to: `supabase/migrations/20260731140000_create_contact_notes.sql`. This file owns the table, constraints, trusted triggers, indexes, legacy backfill, grants, and RLS policies.
- Create: `supabase/tests/database/contact_notes.test.sql` owns feature-specific schema and authorization tests.
- Modify: `supabase/tests/database/security_contract.test.sql` adds `contact_notes` to explicit Data API privilege assertions if the contract enumerates all exposed tables.
- Modify: `supabase/tests/database/performance_contract.test.sql` adds the new RLS policies/indexes if the contract enumerates policy/index optimization requirements.
- Regenerate only through the script: `src/api/types.ts`.

### Entity

- Create: `src/entities/contact-note/model/types.ts` exports generated row/insert/update aliases.
- Create: `src/entities/contact-note/model/sort-contact-notes.ts` exports deterministic pinned-first ordering.
- Create: `src/entities/contact-note/model/sort-contact-notes.test.ts` pins the exact order and tie breakers.
- Create: `src/entities/contact-note/index.ts` exposes the entity's named public API.

### Feature data and validation

- Create: `src/features/contact-notes/api/query-keys.ts` owns workspace/contact-scoped keys.
- Create: `src/features/contact-notes/api/query-keys.test.ts` proves both IDs are present.
- Create: `src/features/contact-notes/api/contact-notes.ts` owns list/create/edit/pin/delete Supabase calls.
- Create: `src/features/contact-notes/model/contact-note-schema.ts` owns the locale-sensitive 5,000-character schema factory and inferred values.
- Create: `src/features/contact-notes/model/contact-note-schema.test.ts` proves trimming and validation.
- Create: `src/features/contact-notes/hooks/use-contact-notes.ts` owns query/mutation hooks and optimistic rollback.
- Create: `src/features/contact-notes/hooks/use-contact-notes.test.tsx` proves cache updates, ordering, rollback, and server reconciliation.

### Feature UI

- Create: `src/features/contact-notes/ui/contact-note-form.tsx` is the reusable create/edit form.
- Create: `src/features/contact-notes/ui/contact-note-item.tsx` renders metadata, action menu, and inline editing.
- Create: `src/features/contact-notes/ui/delete-contact-note-dialog.tsx` owns destructive confirmation.
- Create: `src/features/contact-notes/ui/contact-notes-section.tsx` composes loading/error/empty/list states.
- Create: `src/features/contact-notes/ui/contact-notes-section.test.tsx` covers the requested user flows.
- Create: `src/features/contact-notes/index.ts` exports only `ContactNotesSection` and any intentionally public model APIs.
- Modify: `src/features/inbox/components/contact-panel/contact-panel.tsx` replaces the legacy single-field editor with the feature.
- Modify: `src/features/inbox/components/contact-panel/contact-panel.test.tsx` verifies workspace/contact IDs reach the feature and note errors remain local.
- Delete: `src/features/inbox/components/contact-panel/contact-panel-notes.tsx` after the replacement is covered.
- Modify: `src/features/inbox/api/contacts.ts` removes the dead `updateContactNotes` API while retaining the legacy `notes` field in the contact select/generated row.
- Modify: `src/features/inbox/hooks/use-contact.ts` removes the dead `useUpdateContactNotes` mutation.

### Localization

- Modify: `messages/en.json` adds the `contact_notes_*` catalogue.
- Modify: `messages/ru.json` adds matching Russian copy.
- Do not edit: `src/paraglide/**`; regenerate it through `pnpm i18n:compile` or `pnpm typecheck`.

## Task 1: Establish failing database contracts

**Files:**
- Create: `supabase/tests/database/contact_notes.test.sql`
- Modify if required by enumeration: `supabase/tests/database/security_contract.test.sql`
- Modify if required by enumeration: `supabase/tests/database/performance_contract.test.sql`

- [ ] **Step 1: Inspect the complete pgTAP fixture and role-switching patterns**

Read the full current versions of:

```text
supabase/tests/database/security_contract.test.sql
supabase/tests/database/performance_contract.test.sql
supabase/tests/database/account_profile.test.sql
supabase/tests/database/reactions.test.sql
```

Reuse their UUID fixtures, `set local role`, JWT claim helpers, transaction wrapper, cleanup assumptions, and plan-count style rather than creating a parallel test harness.

- [ ] **Step 2: Write the feature-specific failing pgTAP test**

Create `supabase/tests/database/contact_notes.test.sql` with one transaction and explicit assertions for:

```sql
begin;

-- Use deterministic UUIDs for two users, two workspaces, two memberships, and
-- one contact per workspace. Create auth.users first so profiles and membership
-- foreign keys follow the repository's normal fixture order.

-- Assertions must prove:
-- 1. contact_notes exists, has RLS enabled, and body rejects blank/overlong text.
-- 2. a workspace member can create a note for a contact in that workspace.
-- 3. client-supplied workspace_id and author_id cannot spoof another workspace/user.
-- 4. a cross-workspace contact cannot be attached to the claimed workspace.
-- 5. members see only notes in workspaces they belong to.
-- 6. the author can edit body.
-- 7. a different member cannot edit body but can toggle is_pinned.
-- 8. immutable contact/workspace/author identity cannot be reassigned.
-- 9. the author can delete; another ordinary member cannot; owner/admin can.
-- 10. deleting a non-owner profile leaves the note and author_name snapshot intact.

select * from finish();
rollback;
```

Where a test needs to prove an operation fails, use the repository's established `throws_ok`, visible-row count, or affected-row pattern rather than relying on an English Postgres error string unless the migration intentionally raises a stable application error code.

- [ ] **Step 3: Extend enumerated security/performance contracts**

If `security_contract.test.sql` enumerates browser-accessible tables, add `public.contact_notes` with this exact contract:

```sql
has_table_privilege('authenticated', 'public.contact_notes', 'select')
and has_table_privilege('authenticated', 'public.contact_notes', 'insert')
and has_table_privilege('authenticated', 'public.contact_notes', 'update')
and has_table_privilege('authenticated', 'public.contact_notes', 'delete')
and not has_table_privilege('anon', 'public.contact_notes', 'select')
```

If `performance_contract.test.sql` enumerates RLS policies or foreign-key indexes, add the new policy/index names chosen in Task 2 and increment each file's `plan(...)` count exactly once for every added assertion.

- [ ] **Step 4: Run the database tests and verify RED**

Run:

```cmd
pnpm test:db
```

Expected: failure because `public.contact_notes` does not exist. If local Supabase is not running, run `pnpm supabase:start` and retry. Record any Docker/tooling blocker rather than treating an unexecuted test as RED.

- [ ] **Step 5: Commit the failing database contract**

```cmd
git add supabase/tests/database
git commit -m "test: define contact notes database contract"
```

## Task 2: Implement the contact_notes migration and regenerate types

**Files:**
- Create through CLI and rename to: `supabase/migrations/20260731140000_create_contact_notes.sql`
- Regenerate: `src/api/types.ts`

- [ ] **Step 1: Create the migration through the installed CLI**

Run the CLI, then normalize its generated filename to the exact plan path:

```cmd
pnpm exec supabase migration new create_contact_notes
powershell -NoProfile -Command "$generated = Get-ChildItem 'supabase/migrations/*_create_contact_notes.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1; Move-Item $generated.FullName 'supabase/migrations/20260731140000_create_contact_notes.sql'"
```

Edit only `supabase/migrations/20260731140000_create_contact_notes.sql`. The CLI creates the migration first, while the deterministic rename gives the plan and later reviews one exact path. Do not modify old migrations.

- [ ] **Step 2: Implement the schema, trusted insert/update trigger, and backfill**

The migration must implement this contract, adapted only where the current schema requires qualification:

```sql
begin;

alter table public.contacts
  add constraint contacts_id_workspace_id_key unique (id, workspace_id);

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
    foreign key (contact_id, workspace_id)
    references public.contacts(id, workspace_id)
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

-- Backfill before browser-write enforcement so unknown legacy authors remain null.
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
```

Create one hardened trigger function with `set search_path = ''`. On insert it must:

```sql
select c.workspace_id into new.workspace_id
from public.contacts c
where c.id = new.contact_id;

if new.workspace_id is null then
  raise exception 'CONTACT_NOTE_CONTACT_NOT_FOUND' using errcode = '23503';
end if;

new.body := btrim(new.body);

-- For authenticated Data API writes, ignore spoofed author data.
if (select auth.uid()) is not null then
  new.author_id := (select auth.uid());
  select nullif(btrim(p.full_name), '') into new.author_name
  from public.profiles p
  where p.id = (select auth.uid());
end if;
```

On update it must:

```sql
new.body := btrim(new.body);

if new.workspace_id is distinct from old.workspace_id
  or new.contact_id is distinct from old.contact_id
  or new.author_id is distinct from old.author_id
  or new.author_name is distinct from old.author_name
  or new.created_at is distinct from old.created_at then
  raise exception 'CONTACT_NOTE_IDENTITY_IMMUTABLE' using errcode = '23514';
end if;

if new.body is distinct from old.body
  and old.author_id is distinct from (select auth.uid()) then
  raise exception 'CONTACT_NOTE_BODY_AUTHOR_ONLY' using errcode = '42501';
end if;
```

Install the trusted trigger before insert and before updates of protected/body fields. Install a separate `contact_notes_updated_at` trigger executing `public.handle_updated_at()`.

- [ ] **Step 3: Add grants and RLS policies**

Use explicit privileges:

```sql
alter table public.contact_notes enable row level security;
revoke all on table public.contact_notes from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.contact_notes to authenticated;
grant select, insert, update, delete on table public.contact_notes to service_role;
```

Create policies with stable names:

```sql
create policy "Workspace members can view contact notes"
on public.contact_notes for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace members can create contact notes"
on public.contact_notes for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and author_id = (select auth.uid())
  and exists (
    select 1 from public.contacts c
    where c.id = contact_notes.contact_id
      and c.workspace_id = contact_notes.workspace_id
  )
);

create policy "Workspace members can update contact note pins and own content"
on public.contact_notes for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.contacts c
    where c.id = contact_notes.contact_id
      and c.workspace_id = contact_notes.workspace_id
  )
);

create policy "Authors and workspace admins can delete contact notes"
on public.contact_notes for delete to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = contact_notes.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = any (array['owner'::text, 'admin'::text])
  )
);
```

Revoke direct execute access to the new trigger function from `public`, `anon`, and `authenticated`, matching current trigger-helper hardening.

- [ ] **Step 4: Reset the local database and verify GREEN**

Run:

```cmd
pnpm supabase:reset
pnpm test:db
```

Expected: all pgTAP suites pass, including the new cross-workspace and authorization assertions.

- [ ] **Step 5: Regenerate local Supabase types**

Run:

```cmd
pnpm types:supabase:local
```

Confirm `src/api/types.ts` contains `contact_notes` Row/Insert/Update and both profile/contact/workspace relationships. Do not hand-edit the generated file.

- [ ] **Step 6: Commit the migration and generated types**

```cmd
git add supabase/migrations supabase/tests/database src/api/types.ts
git commit -m "feat: add secure contact notes storage"
```

## Task 3: Add the contact-note entity and validation schema

**Files:**
- Create: `src/entities/contact-note/model/types.ts`
- Create: `src/entities/contact-note/model/sort-contact-notes.ts`
- Create: `src/entities/contact-note/model/sort-contact-notes.test.ts`
- Create: `src/entities/contact-note/index.ts`
- Create: `src/features/contact-notes/model/contact-note-schema.ts`
- Create: `src/features/contact-notes/model/contact-note-schema.test.ts`

- [ ] **Step 1: Write failing ordering and validation tests**

Use generated types in fixtures and prove:

```ts
expect(sortContactNotes([regularNew, pinnedOld, pinnedNew, regularOld])).toEqual([
  pinnedNew,
  pinnedOld,
  regularNew,
  regularOld,
])
```

Also prove the `id` descending tie breaker when timestamps match, and prove the source array is not mutated.

Validation tests must run with `setLocale('en', { reload: false })` and assert:

```ts
expect(createContactNoteSchema().safeParse({ body: '' }).success).toBe(false)
expect(createContactNoteSchema().safeParse({ body: '   ' }).success).toBe(false)
expect(createContactNoteSchema().parse({ body: '  line one\nline two  ' })).toEqual({
  body: 'line one\nline two',
})
expect(createContactNoteSchema().safeParse({ body: 'x'.repeat(5001) }).success).toBe(false)
```

- [ ] **Step 2: Run focused tests and verify RED**

```cmd
pnpm test -- src/entities/contact-note/model/sort-contact-notes.test.ts src/features/contact-notes/model/contact-note-schema.test.ts
```

Expected: module-not-found failures for the new entity and schema.

- [ ] **Step 3: Implement generated aliases and stable ordering**

`src/entities/contact-note/model/types.ts`:

```ts
import type { Tables, TablesInsert, TablesUpdate } from '@/api/types'

export type ContactNote = Tables<'contact_notes'>
export type ContactNoteInsert = TablesInsert<'contact_notes'>
export type ContactNoteUpdate = TablesUpdate<'contact_notes'>
```

`sortContactNotes` must return a new array and compare in this order: pinned true first, `updated_at` descending, `created_at` descending, then `id` descending. Export these names explicitly from `src/entities/contact-note/index.ts`.

- [ ] **Step 4: Implement the localized schema factory**

`src/features/contact-notes/model/contact-note-schema.ts`:

```ts
import { m } from '@/paraglide/messages'
import { z } from 'zod'

export const CONTACT_NOTE_MAX_LENGTH = 5000

export function createContactNoteSchema() {
  return z.object({
    body: z
      .string()
      .trim()
      .min(1, m.contact_notes_validation_required())
      .max(CONTACT_NOTE_MAX_LENGTH, m.contact_notes_validation_max({ max: CONTACT_NOTE_MAX_LENGTH })),
  })
}

export type ContactNoteFormValues = z.infer<
  ReturnType<typeof createContactNoteSchema>
>
```

Add the referenced English and Russian validation keys before running the tests so Paraglide can compile.

- [ ] **Step 5: Run focused tests and verify GREEN**

```cmd
pnpm typecheck
pnpm test -- src/entities/contact-note/model/sort-contact-notes.test.ts src/features/contact-notes/model/contact-note-schema.test.ts
```

- [ ] **Step 6: Commit the entity and schema**

```cmd
git add src/entities/contact-note src/features/contact-notes/model messages/en.json messages/ru.json src/paraglide
git commit -m "feat: define contact note model and validation"
```

## Task 4: Add focused Supabase APIs and scoped query keys

**Files:**
- Create: `src/features/contact-notes/api/query-keys.ts`
- Create: `src/features/contact-notes/api/query-keys.test.ts`
- Create: `src/features/contact-notes/api/contact-notes.ts`

- [ ] **Step 1: Write the failing query-key test**

```ts
expect(contactNoteQueryKeys.list('workspace-1', 'contact-1')).toEqual([
  'contact-notes',
  'workspace-1',
  'contact-1',
])
expect(contactNoteQueryKeys.list('workspace-2', 'contact-1')).not.toEqual(
  contactNoteQueryKeys.list('workspace-1', 'contact-1'),
)
```

- [ ] **Step 2: Run the key test and verify RED**

```cmd
pnpm test -- src/features/contact-notes/api/query-keys.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement keys and API functions**

Define:

```ts
export const contactNoteQueryKeys = {
  all: ['contact-notes'] as const,
  list: (workspaceId: string, contactId: string) =>
    ['contact-notes', workspaceId, contactId] as const,
}
```

Implement these exact APIs in `contact-notes.ts`:

```ts
listContactNotes(workspaceId: string, contactId: string): Promise<ContactNote[]>
createContactNote(input: { workspaceId: string; contactId: string; body: string }): Promise<ContactNote>
updateContactNoteBody(input: { workspaceId: string; contactId: string; noteId: string; body: string }): Promise<ContactNote>
setContactNotePinned(input: { workspaceId: string; contactId: string; noteId: string; isPinned: boolean }): Promise<ContactNote>
deleteContactNote(input: { workspaceId: string; contactId: string; noteId: string }): Promise<void>
```

Every operation must filter by `workspace_id` and `contact_id`; row mutations also filter by `id`. List ordering must make four `.order(...)` calls for `is_pinned`, `updated_at`, `created_at`, and `id`. Create sends workspace/contact/body only and relies on the database to establish author identity. Mutations returning a row use `.select().single()` and throw the Supabase error unchanged.

- [ ] **Step 4: Verify the key/API layer**

```cmd
pnpm typecheck
pnpm test -- src/features/contact-notes/api/query-keys.test.ts
```

- [ ] **Step 5: Commit**

```cmd
git add src/features/contact-notes/api
git commit -m "feat: add contact notes data API"
```

## Task 5: Implement TanStack Query hooks with optimistic rollback

**Files:**
- Create: `src/features/contact-notes/hooks/use-contact-notes.ts`
- Create: `src/features/contact-notes/hooks/use-contact-notes.test.tsx`

- [ ] **Step 1: Write failing hook tests with a real QueryClient**

Mock only `../api/contact-notes`. Use `createTestQueryClient`, `QueryClientProvider`, and probe buttons as in `use-notification-preferences.test.tsx`.

Cover these behaviors independently:

```text
useContactNotes uses contactNoteQueryKeys.list(workspaceId, contactId)
create adds the returned row and re-sorts the list
edit replaces the returned row
pin updates immediately and moves the note before regular notes
failed pin restores the complete previous list
confirmed delete removes immediately
failed delete restores the complete previous list
successful server responses replace optimistic rows exactly
```

Use a never-resolving promise to observe the optimistic state before settlement and `mockRejectedValue(new Error('offline'))` to verify rollback.

- [ ] **Step 2: Run hook tests and verify RED**

```cmd
pnpm test -- src/features/contact-notes/hooks/use-contact-notes.test.tsx
```

Expected: missing hook module.

- [ ] **Step 3: Implement query and mutation hooks**

Export:

```ts
useContactNotes(workspaceId: string, contactId: string)
useCreateContactNote(workspaceId: string, contactId: string)
useUpdateContactNote(workspaceId: string, contactId: string)
useSetContactNotePinned(workspaceId: string, contactId: string)
useDeleteContactNote(workspaceId: string, contactId: string)
```

For pin/delete `onMutate`:

```ts
await queryClient.cancelQueries({ queryKey: key })
const snapshot = queryClient.getQueryData<ContactNote[]>(key)
queryClient.setQueryData<ContactNote[]>(key, current =>
  sortContactNotes(
    (current ?? []).map(note =>
      note.id === variables.noteId
        ? { ...note, is_pinned: variables.isPinned }
        : note,
    ),
  ),
)
return { snapshot }
```

For errors, restore whenever `snapshot !== undefined`, including an empty array. On successful create/edit/pin, merge the returned row by ID and call `sortContactNotes`. On delete success, keep the optimistic removal. In `onSettled`, invalidate only the exact scoped key when reconciliation is needed. Do not use a global `contact-notes` invalidation.

- [ ] **Step 4: Run hook tests and verify GREEN**

```cmd
pnpm test -- src/features/contact-notes/hooks/use-contact-notes.test.tsx
pnpm typecheck
```

- [ ] **Step 5: Commit**

```cmd
git add src/features/contact-notes/hooks
git commit -m "feat: add optimistic contact note queries"
```

## Task 6: Discover Astryx APIs and build the accessible UI test-first

**Files:**
- Create: `src/features/contact-notes/ui/contact-note-form.tsx`
- Create: `src/features/contact-notes/ui/contact-note-item.tsx`
- Create: `src/features/contact-notes/ui/delete-contact-note-dialog.tsx`
- Create: `src/features/contact-notes/ui/contact-notes-section.tsx`
- Create: `src/features/contact-notes/ui/contact-notes-section.test.tsx`
- Create: `src/features/contact-notes/index.ts`
- Modify: `messages/en.json`
- Modify: `messages/ru.json`

- [ ] **Step 1: Discover exact installed Astryx components before JSX**

Run:

```cmd
pnpm exec astryx build "compact contact notes section with textarea, action menu, inline edit, skeleton, retry, and destructive confirmation"
pnpm exec astryx component TextArea
pnpm exec astryx component Button
pnpm exec astryx component DropdownMenu
pnpm exec astryx component AlertDialog
pnpm exec astryx component Skeleton
```

Inspect repository usage and installed type declarations if any CLI output disagrees with current usage. Do not guess HeroUI props and do not add compatibility shims.

- [ ] **Step 2: Add complete localized copy**

Add matching `contact_notes_*` keys for:

```text
section title; add action; textarea label and placeholder; save; saving; cancel;
empty title and description; load error; retry; unknown/imported author;
created metadata; updated metadata; actions label; edit; pin; unpin; delete;
delete dialog title, description, action; create/update/delete success;
save, pin, and delete error messages; validation required and max;
accessible pinned label; accessible timestamp text.
```

Russian is the base experience. Keep fixed-width button/action labels concise and add any necessary length budgets to `src/lib/message-lengths.test.ts` if the existing audit requires them.

- [ ] **Step 3: Write failing component-flow tests**

Mock `use-contact-notes.ts` hooks with stateful test doubles or mock API functions beneath a real QueryClient. Cover user-visible behavior:

```text
loading renders compact skeletons
load failure renders inline error and Retry without replacing contact context
empty state says no notes and focuses/opens the composer action
pinned notes render before regular notes
creation sends trimmed body and clears only after success
failed creation preserves typed body and displays localized error
repeated clicks while pending submit once
edit opens inline with current content; cancel restores display
successful edit updates visible body and returns focus
failed edit preserves unsaved content
pin action changes ordering
failed pin shows error while hook test proves rollback
delete does nothing until the AlertDialog action is confirmed
failed delete shows error while hook test proves rollback
line breaks render with pre-wrap semantics
action menu labels and icon-only controls have accessible names
```

Use `setLocale('en', { reload: false })`, role/name queries, and visible behavior rather than component internals.

- [ ] **Step 4: Run UI tests and verify RED**

```cmd
pnpm test -- src/features/contact-notes/ui/contact-notes-section.test.tsx
```

Expected: missing component module.

- [ ] **Step 5: Implement the reusable form**

`ContactNoteForm` accepts:

```ts
type ContactNoteFormProps = {
  defaultBody?: string
  mode: 'create' | 'edit'
  isPending: boolean
  serverError?: string
  onCancel?: () => void
  onSubmit: (values: ContactNoteFormValues) => void
}
```

Use `useLocalizedSchema(createContactNoteSchema)`, `standardSchemaResolver`, `Controller`, and Astryx `TextArea`. Set `disabled: isPending`, guard `if (isPending) return`, associate `fieldState.error.message` through `status`, and reset only when the parent reports successful creation. The edit form keeps local unsaved content on request failure.

- [ ] **Step 6: Implement note items and delete confirmation**

`ContactNoteItem` receives the note, current user ID, admin flag, and mutation callbacks. Use `formatDate(note.updated_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })`. Compare `updated_at` and `created_at` to choose localized created/updated wording.

Render:

```tsx
<p className="text-primary whitespace-pre-wrap break-words text-sm">{note.body}</p>
```

Use a restrained pin icon and tonal background only for pinned rows. `DropdownMenu` uses an icon-only ghost trigger with a localized label. Show Edit only when `note.author_id === currentUserId`; show Delete when author or admin; show Pin/Unpin for every accessible note. Mount one controlled `AlertDialog` for the selected delete action and keep danger styling only on `actionVariant="destructive"`.

- [ ] **Step 7: Implement the section state machine**

`ContactNotesSection({ workspaceId, contactId })` uses `useAuth`, `useMyMemberships`, and the note hooks. Derive admin with:

```ts
const role = memberships.data?.find(item => item.workspaceId === workspaceId)?.role
const canAdminDelete = role === 'owner' || role === 'admin'
```

Render the compact composer, local query error/retry, stable skeleton, useful empty state, and sorted list. Use toasts for mutation success/failure while keeping form content in place. Prevent duplicate submissions with both form disabling and mutation pending guards.

- [ ] **Step 8: Run UI tests and verify GREEN**

```cmd
pnpm i18n:compile
pnpm test -- src/features/contact-notes/ui/contact-notes-section.test.tsx
pnpm typecheck
```

- [ ] **Step 9: Commit the UI**

```cmd
git add src/features/contact-notes messages/en.json messages/ru.json src/paraglide src/lib/message-lengths.test.ts
git commit -m "feat: add contact notes workflow UI"
```

## Task 7: Integrate into the contact panel and remove the legacy editor

**Files:**
- Modify: `src/features/inbox/components/contact-panel/contact-panel.tsx`
- Modify: `src/features/inbox/components/contact-panel/contact-panel.test.tsx`
- Delete: `src/features/inbox/components/contact-panel/contact-panel-notes.tsx`
- Modify: `src/features/inbox/api/contacts.ts`
- Modify: `src/features/inbox/hooks/use-contact.ts`

- [ ] **Step 1: Update the contact-panel test first**

Replace the legacy `ContactPanelNotes` mock with a `ContactNotesSection` mock that records props. Assert the rendered panel passes:

```ts
expect(contactNotesProps).toEqual({
  workspaceId: 'workspace-1',
  contactId: 'contact-1',
})
```

Retain all existing avatar precedence tests.

- [ ] **Step 2: Run the panel test and verify RED**

```cmd
pnpm test -- src/features/inbox/components/contact-panel/contact-panel.test.tsx
```

Expected: the panel still imports/renders the legacy component.

- [ ] **Step 3: Replace the legacy component**

Import `ContactNotesSection` from `@/features/contact-notes` and render it only when contact data is available:

```tsx
<ContactNotesSection
  workspaceId={workspaceId}
  contactId={contactQuery.data.id}
/>
```

Keep a compact skeleton in the same location while the contact itself loads. Do not change route files, panel shell, avatar, channels, or status layout.

Delete `contact-panel-notes.tsx`. Remove `updateContactNotes` from `api/contacts.ts` and `useUpdateContactNotes` from `hooks/use-contact.ts`; keep all unrelated contact query behavior intact.

- [ ] **Step 4: Run integration and nearby tests**

```cmd
pnpm test -- src/features/inbox/components/contact-panel/contact-panel.test.tsx src/features/contact-notes/ui/contact-notes-section.test.tsx
pnpm typecheck
```

- [ ] **Step 5: Commit integration**

```cmd
git add src/features/inbox src/features/contact-notes
git commit -m "feat: integrate notes into contact panel"
```

## Task 8: Broad validation and browser verification

**Files:**
- Modify only if validation finds a feature defect in the files above.

- [ ] **Step 1: Run focused tests together**

```cmd
pnpm test -- src/entities/contact-note src/features/contact-notes src/features/inbox/components/contact-panel/contact-panel.test.tsx
```

Expected: all focused tests pass with no React warnings or unhandled promise rejections.

- [ ] **Step 2: Run generated/i18n/type validation**

```cmd
pnpm typecheck
pnpm i18n:audit
```

Expected: Paraglide compiles, key parity holds, no user-facing English is hardcoded, and TypeScript passes.

- [ ] **Step 3: Run code quality and complete unit suite**

```cmd
pnpm lint
pnpm test
pnpm build
```

Expected: all commands exit zero.

- [ ] **Step 4: Run database validation**

```cmd
pnpm test:db
```

Expected: all pgTAP suites pass. If Docker/Supabase is unavailable, capture the exact command output and report the test as not run rather than passed.

- [ ] **Step 5: Run broad verification when practical**

```cmd
pnpm verify
```

This intentionally repeats earlier checks as the repository's release-sensitive aggregate.

- [ ] **Step 6: Browser-check the real contact panel**

Build and start the app using repository scripts, then use the shared development test account only against the development Supabase project. Inspect:

```text
English and Russian
light and dark modes
desktop contact panel and narrow drawer width
empty, loading, error, populated, inline-edit, pending, and delete-dialog states
keyboard operation of composer, menu, edit, pin, and confirmation
no note text appears in the conversation message list or outbound payload
```

Capture a screenshot of the populated notes section in at least Russian desktop and narrow width when browser infrastructure is available.

- [ ] **Step 7: Review final diff and scope**

Run:

```cmd
git diff --check
git status --short
git diff --stat HEAD~8..HEAD
git log --oneline -10
```

Confirm no Companies, Tasks, Deals, AI summaries, top-level Notes navigation, generic timeline, dependency changes, old-migration edits, or manual generated-file edits entered the diff.

- [ ] **Step 8: Request code review and fix verified findings**

Invoke the repository's code-review workflow against the confirmed design and this plan. Apply only findings that reproduce or clearly violate a requirement, then rerun the smallest affected test plus `pnpm typecheck`.

- [ ] **Step 9: Commit any final verified fixes**

```cmd
git add -A
git commit -m "fix: finalize contact notes workflow"
```

Skip this commit when the tree is already clean.
