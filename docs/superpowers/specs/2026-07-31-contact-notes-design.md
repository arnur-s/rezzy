# Contact Notes Design

**Date:** 2026-07-31

## Goal

Add lightweight, internal, workspace-scoped notes to the contact panel so sales and account-management teams can capture customer context without leaving the active conversation. Notes remain CRM data and never enter the message pipeline.

## Repository findings

- The active contact experience lives in `src/features/inbox/components/contact-panel/` rather than the placeholder contacts route.
- The current implementation stores one free-form value in `contacts.notes` and saves it on blur.
- Rezzy uses Astryx (`@astryxdesign/core`), not HeroUI. New UI must use the installed Astryx APIs and token-backed Tailwind utilities.
- TanStack Query keys are plain `as const` factories. Existing optimistic mutations cancel the query, capture a snapshot, update the cache, and restore the snapshot on error.
- Supabase access is workspace-scoped through `public.is_workspace_member(uuid)`, explicit Data API grants, and per-operation RLS policies.
- `public.handle_updated_at()` is the shared timestamp trigger.
- Profiles are currently readable only by their owner. A direct profile join would not reliably expose another note author's name.

## Approaches considered

### 1. Dedicated contact-note entity and feature

Create `src/entities/contact-note` for domain types and deterministic ordering, plus `src/features/contact-notes` for API functions, schemas, query hooks, mutations, and UI. The existing inbox contact panel composes the feature.

This is the selected approach. Contact notes are a reusable CRM concept that may later appear in a contact activity timeline, while the workflow remains embedded in the inbox today.

### 2. Keep all note code inside the inbox feature

This minimizes directories and resembles the current single-field implementation. It would, however, make a reusable contact-note domain depend conceptually on inbox ownership and make later reuse harder.

### 3. Build a generic contact activity framework

A common activity abstraction could support notes, tasks, deals, and timeline events. It is rejected because no meaningful duplication exists yet and it would expand the task beyond Contact Notes.

## Database design

Create `public.contact_notes` with:

- `id uuid primary key default gen_random_uuid()`
- `workspace_id uuid not null`
- `contact_id uuid not null`
- `author_id uuid null`
- `author_name text null`
- `body text not null`
- `is_pinned boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`author_name` is a server-populated historical snapshot. It allows every workspace member to see the creator without broadening access to the full `profiles` row, and it preserves attribution after a profile is removed. New notes always have an author. Imported legacy notes may have no known author.

Foreign-key behavior:

- Workspace deletion cascades to notes.
- Contact deletion cascades to notes.
- Profile deletion sets `author_id` to null while retaining the author-name snapshot and note content.
- A composite contact/workspace relationship or an equivalent database trigger prevents attaching a note to a contact in another workspace.

Database validation and triggers:

- Trim `body` before storage.
- Require a trimmed body length from 1 through 5,000 characters.
- On browser-originated inserts, derive `workspace_id` from the selected contact and set `author_id` to `auth.uid()` rather than trusting client values.
- Snapshot the author's current nonblank profile name.
- Keep contact, workspace, author identity, and creation time immutable after insertion.
- Reuse `public.handle_updated_at()` for updates.

Indexes support the exact list order and authorization lookups:

- `(workspace_id, contact_id, is_pinned desc, updated_at desc, created_at desc, id desc)`
- `author_id` for the foreign key and author checks

Existing nonblank `contacts.notes` values are copied into `contact_notes` as unpinned imported notes with unknown authors. The legacy column remains intact to avoid a destructive schema change, but the application stops reading and writing it.

## Authorization and RLS

Enable RLS and grant `authenticated` the exact `select`, `insert`, `update`, and `delete` table privileges.

Policies and trigger enforcement provide these behaviors:

- Workspace members can list notes only from accessible workspaces.
- Inserts require membership and a contact in that same workspace. The database replaces client-supplied workspace and author identity with trusted values.
- Any workspace member may change `is_pinned`, matching the collaborative nature of important team context.
- Only the original author may change `body`.
- The original author may delete a note. Workspace owners and admins may also delete, consistent with existing administrative delete conventions.
- Workspace/contact/author identity cannot be reassigned through an update.
- Anonymous callers receive no table privileges.

Database tests cover cross-workspace read, insert, update, and delete denial, author spoofing prevention, contact/workspace mismatch prevention, author-only body edits, collaborative pinning, administrative deletion, body validation, and legacy note preservation.

## Client architecture

### Entity

`src/entities/contact-note/` owns:

- generated table row/insert/update aliases
- the UI-facing note type
- deterministic pinned-first ordering
- explicit named exports

### Feature

`src/features/contact-notes/` owns:

- focused Supabase API functions for list, create, content update, pin update, and delete
- a query-key factory that includes both workspace ID and contact ID
- TanStack Query hooks and optimistic cache helpers
- the localized note schema factory
- composer, list, item, editor, and delete confirmation UI
- explicit named exports

The existing contact panel passes `workspaceId` and `contactId` to the feature. Route files do not change.

## Query and mutation behavior

The list query key has the shape `['contact-notes', workspaceId, contactId]`.

The API applies deterministic database ordering:

1. `is_pinned desc`
2. `updated_at desc`
3. `created_at desc`
4. `id desc`

The entity sorting helper applies the same order whenever optimistic cache updates change a list.

Mutation strategy:

- **Create:** wait for the returned server row, insert it into the cache, and reset the composer only after success. Failure preserves the typed body.
- **Edit:** wait for the returned server row and replace the cached row on success. Failure leaves the inline editor and unsaved text intact.
- **Pin/unpin:** optimistically update and re-sort the cached list. Restore the complete snapshot on error and reconcile with the returned row on success.
- **Delete:** optimistically remove the row after confirmation. Restore the complete snapshot on error.
- Every mutation prevents duplicate submission while pending.
- Settled mutations invalidate the scoped list when needed so the server remains authoritative.

## UI design

Replace the existing single textarea with a `ContactNotesSection` inside the contact panel.

The section contains:

- a compact heading and note composer
- a small loading skeleton with stable height
- an inline load error and retry action
- a restrained empty state with a direct add-note action
- pinned notes first, marked only by a small pin icon
- regular notes below without separate nested cards or a table

Each note is a readable text block with preserved line breaks, author name, localized timestamp, and an accessible action menu. The timestamp indicates whether the note was created or updated and exposes understandable text to assistive technology.

The action menu contains:

- Edit, only for the current author
- Pin or unpin, for workspace members
- Delete, only when the current client authorization permits it

Inline editing uses the same localized React Hook Form and Zod schema as creation. Cancel preserves the server value, saving shows a pending state, and focus returns to the edited note's action control after success. Deletion uses Astryx `AlertDialog`; destructive styling appears only on the confirmation action.

The design follows Rezzy's compact two-size typography, tonal surfaces, visible focus states, and restrained color use. It introduces no new navigation, large empty container, gradient, colored side border, nested-card stack, or unconditional dark-mode shadow.

## Accessibility

- All operations use buttons, menus, forms, or dialogs with keyboard support.
- Icon-only controls have localized labels.
- Textarea validation is exposed through Astryx status/error APIs and associated semantics.
- Pending and disabled states are communicated through component props and visible labels.
- The deletion dialog has localized title, description, cancel, and destructive action labels.
- Note body line breaks remain readable with `white-space: pre-wrap` behavior.
- Focus remains visible and returns to a sensible note action after editing.

## Internationalization

Add readable `contact_notes_*` keys to both `messages/en.json` and `messages/ru.json`. Validation messages live in a `createContactNoteSchema()` factory consumed through `useLocalizedSchema`, preventing locale freezing. Generated Paraglide files are regenerated only through `pnpm i18n:compile` or commands that invoke it.

## Testing and validation

Test-first implementation covers:

- schema trimming, empty/whitespace rejection, and maximum length
- query-key workspace/contact scoping
- deterministic pinned-first ordering
- creation success and failed-content preservation
- editing success and failed-content preservation
- pin reordering and rollback
- delete confirmation and rollback
- contact-panel integration without replacing the whole contact screen on note errors
- database workspace isolation and authorization rules

Validation will include focused Vitest files during development, then `pnpm typecheck`, `pnpm i18n:audit`, `pnpm lint`, `pnpm test`, `pnpm test:db`, and `pnpm build` where local services are available. Browser verification will inspect the contact panel in Russian and English, light and dark modes, and a narrow viewport when practical.

## Scope boundaries

This design does not add Companies, Tasks, Deals, AI summaries, top-level Notes navigation, a standalone contacts directory, or a generic activity timeline. It does not add dependencies or manually edit generated source files.
