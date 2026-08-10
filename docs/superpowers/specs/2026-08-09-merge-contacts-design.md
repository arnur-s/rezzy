# Merge contacts — design

**Date:** 2026-08-09
**Status:** approved, not implemented

Deterministic (non-AI) contact deduplication for the contacts directory: a
duplicate finder built on exact identity keys, and a one-way merge guarded by a
destructive confirmation.

---

## 1. Problem

A workspace accumulates duplicate contacts by ordinary use. A customer writes in
on WhatsApp and a contact is created from the inbound message; someone later
types the same person in by hand from a phone call; the same person messages a
second connected Instagram account. Nothing today collapses them, so the
directory shows one person several times, their history is split across records,
and the conversation each teammate reads is only part of the story.

The product already refuses to guess: `match_workspace_contacts` matches on
normalized phone digits, channel identity and exact email, and
`contact-identity.ts` states outright that a display name is not an identifier.
This feature keeps that discipline. Detection is exact-key only; a human chooses
the survivor and every field; no model is involved anywhere.

## 2. Scope

In scope:

- a duplicate finder over exact identity keys, as a third directory view
- manual merge of exactly two contacts, from the finder or from the directory
- a two-column field picker for conflicting scalar fields
- a destructive confirmation naming the exact consequence
- a redirect from a merged contact's URL to its survivor

Out of scope, deliberately:

- **Unmerge.** The merge is one-way. §5 explains what that does and does not
  destroy, which is far less than it sounds.
- **Fuzzy/scored matching** (trigram name similarity, blocking keys, confidence
  bands). The indexes exist and this is the natural next step, but thresholds
  are untunable until real merges have happened.
- **N-way merge.** Exactly two at a time. The picker is a two-column comparison;
  N-way needs a different component.
- **Folding two conversations on the same channel.** §4.3 refuses that merge
  instead. Folding threads means repointing messages and recomputing counters,
  and it is a feature of its own.
- **Any AI involvement**, now or as a follow-up to this spec.

## 3. What already exists

| Asset | Location |
|---|---|
| `phone_digits()` — canonical, IMMUTABLE, indexed | `supabase/migrations/20260803120000_contact_phones_and_identity_match.sql` |
| `contact_phones` with `(workspace_id, digits)` index | same |
| `match_workspace_contacts()` — exact identity lookup, SECURITY INVOKER | same |
| `archive_contact` / `restore_contact` / `list_archived_contacts` | `supabase/migrations/20260808090100_contact_archive_rpcs.sql` |
| `trg_cascade_contact_archive` — carries `deleted_at` to conversations | same migration's preamble |
| `pg_trgm` + GIN on `contacts(name, email, phone)` | `supabase/migrations/20260731170000_add_contact_owner_and_directory_indexes.sql` |
| Directory view, archived view, filters, pagination | `src/features/contacts/ui/contacts-page.tsx` |

Exactly four tables reference a contact: `conversations`, `contact_notes`,
`contact_phones`, `contact_channels`. A merge is a bounded repoint.

## 4. Data model

### 4.1 New columns on `public.contacts`

```sql
alter table public.contacts
  add column merged_into_id uuid,
  add column merged_at      timestamptz,
  add column merged_by      uuid references public.profiles(id) on delete set null;

-- Composite, so a merge can never cross a workspace boundary.
alter table public.contacts add constraint contacts_merged_into_fkey
  foreign key (workspace_id, merged_into_id)
  references public.contacts(workspace_id, id);

-- A merged contact is archived, always. Nothing may leave one live.
alter table public.contacts add constraint contacts_merged_is_archived_check
  check (merged_into_id is null or deleted_at is not null);

create index contacts_merged_into_idx
  on public.contacts (workspace_id, merged_into_id)
  where merged_into_id is not null;
```

There is no merge-log table. It was designed and then removed: its only real job
was feeding unmerge, and its audit value is already covered. The merged contact's
row survives soft-deleted with every scalar field untouched, `merged_into_id`
records where it went, and `merged_at` / `merged_by` record when and by whom.
Three columns replace a table.

Chains are prevented, not merely assumed away: `merge_contacts` refuses a loser
that already carries a `merged_into_id` (so the same contact cannot be merged
twice), and whenever a survivor is itself later merged away as someone else's
loser — the ordinary workflow, not a race: merge A into B today, and next week
the duplicates view offers {B, C} and someone merges B into C — `merge_contacts`
repoints every contact that pointed at B onto C in the same transaction. So
`merged_into_id` always points at a contact that has not itself been merged, and
the redirect in §7.4 is one hop, not a walk. The survivor may later be archived
by ordinary means; §7.4 says what the redirect does then.

### 4.2 What collides

| Child table | Unique constraint | Behaviour |
|---|---|---|
| `contact_notes` | none | plain repoint |
| `contact_channels` | `(channel_id, external_id)`, global | cannot collide — two contacts cannot hold one identity on one channel |
| `contact_phones` | `(contact_id, digits)` | repoint `on conflict do nothing`, then delete the loser's leftover row |
| `conversations` | `(contact_id, channel_id)` | **collides; see §4.3** |

### 4.3 The conversation clash

`conversations_contact_channel_unique unique (contact_id, channel_id)`
(`supabase/migrations/20260509120000_create_inbox_core_tables.sql`) cannot be
relaxed: all three inbound resolvers use it as an `on conflict` target — see
`resolve_instagram_conversation` in
`supabase/migrations/20260809120000_workspace_soft_delete_containment.sql`.

So when both contacts hold a thread on the *same channel row*, the merge
**refuses**: `raise exception 'CONTACT_MERGE_CONVERSATION_CONFLICT' using
errcode = 'P0001'`, and the whole transaction rolls back. The dialog names the
channel and disables the action before the user can reach the confirm step.

This is uncommon. Exact-phone duplicates almost always pair a channel-created
contact with a hand-typed one that has no threads at all. It happens when two
contacts matched by email each have a thread on one connected account.

Refusing is chosen over folding because folding means repointing `messages`,
recomputing `unread_count` / `last_message_at` / `last_message_preview`, and
producing a result no one can inspect afterwards. It is a coherent follow-up
feature; `messages_unique_external_id (workspace_id, conversation_id,
external_id)` will not fight it, since distinct provider messages carry distinct
external ids.

## 5. What a merge destroys

Stated precisely, because it is the copy in the confirmation dialog and because
"irreversible" is otherwise read as worse than it is.

| | |
|---|---|
| Loser's scalar fields | **kept** — its archived row still holds them |
| Loser's tags | **kept** on the loser; unioned onto the survivor |
| Survivor's `last_seen_at` | **updated** to the later of the two — never a choice, and `GREATEST` ignores a null on either side |
| Notes, conversations, channels, phones | **moved**, not deleted |
| Loser phone rows dropped as exact digit duplicates | the survivor already holds that number; nothing is lost |
| **Survivor's overwritten `name`, `email`, `owner_id`, `status`, `avatar_url`, `source`** | **destroyed** |

The last row is the only irreversible loss, and it is exactly what the picker
chose. The confirmation names the specific fields and their old values instead
of issuing a generic warning.

## 6. Database functions

### 6.1 `merge_contacts`

```sql
public.merge_contacts(
  p_survivor_id uuid,
  p_merged_id   uuid,
  p_fields      jsonb
) returns void
```

`SECURITY DEFINER`, `set search_path = ''`, with the owner/admin gate copied from
`archive_contact` — merge is strictly more destructive than archive and must not
carry a weaker authority. Same opaque `NOT_A_WORKSPACE_ADMIN` (42501) for "not an
admin" and "no such contact", following the archive RPCs' reasoning that a
definer function distinguishing them tells any caller whether an arbitrary uuid
names a real contact.

Steps, in this order:

1. `auth.uid()` null → `NOT_AUTHENTICATED` (28000).
2. Lock both contact rows `for update`, **ordered by id**. Two admins merging the
   same pair in opposite directions would otherwise deadlock.
3. Assert: `p_survivor_id <> p_merged_id`; both rows exist; same `workspace_id`;
   both `deleted_at is null`; both `merged_into_id is null`. Caller is an
   owner/admin of that workspace.
4. Probe for a shared `channel_id` between the two contacts' conversations →
   `CONTACT_MERGE_CONVERSATION_CONFLICT` if any.
5. Apply `p_fields` to the survivor, **validated against a server-side
   allowlist** of `name`, `email`, `owner_id`, `status`, `avatar_url`, `source`.
   The client chooses which *value* wins; it never names a column. Each value is
   checked against the same constraints the column carries (`contacts_status_check`,
   `contacts_source_check`, and `owner_id` must be a member of the workspace).
   `tags` is always the union of both, never a choice.
6. Repoint `conversations`, then `contact_notes`, then `contact_channels`, then
   `contact_phones` (`on conflict (contact_id, digits) do nothing`, then delete
   the loser's remaining rows).
7. Renumber the survivor's `contact_phones.position` and sync `contacts.phone` to
   position 0, matching what `set_contact_phones` guarantees.
8. **Only now** stamp the loser: `deleted_at = now()`, `merged_into_id`,
   `merged_at = now()`, `merged_by = auth.uid()`, `updated_at = now()`.
   Last, deliberately — `trg_cascade_contact_archive` would otherwise stamp
   `deleted_at` onto conversations that are about to become the survivor's.
   §10 gives this its own test.

Grants follow the archive RPCs: `revoke all … from public, anon, authenticated,
service_role` then `grant execute … to authenticated`.

### 6.2 `restore_contact` — required change

`restore_contact` currently clears `deleted_at` unconditionally. On a merged
contact that leaves `merged_into_id` set on a live row, violating
`contacts_merged_is_archived_check` and surfacing as a raw 23514. A restored
merge-shell would also be a contact with no conversations, notes or phones,
which is not something anyone wants back.

So it gains an explicit refusal before its `update`:

```sql
if exists (
  select 1 from public.contacts c
  where c.id = p_contact_id and c.merged_into_id is not null
) then
  raise exception 'CONTACT_IS_MERGED' using errcode = 'P0001';
end if;
```

`list_archived_contacts` gains `merged_into_id` and the survivor's display name
to its `RETURNS TABLE`, so the archived view can render "объединён с X" and omit
the Restore button rather than offering one that errors.

### 6.3 `list_duplicate_contact_groups`

```sql
public.list_duplicate_contact_groups(
  p_workspace_id uuid,
  p_limit        integer default 20,
  p_offset       integer default 0
) returns table (
  group_key     text,
  match_reason  text,     -- 'phone' | 'channel' | 'email'
  contacts      jsonb,
  contact_count integer,
  total_count   bigint
)
```

`SECURITY INVOKER`, following `match_workspace_contacts`: RLS on `public.contacts`
is the boundary and `p_workspace_id` only narrows. Live rows only
(`deleted_at is null`), so merged and archived contacts never reappear as their
own duplicates.

Three grouping keys, unioned, each `having count(distinct contact_id) > 1`:

- **phone** — `contact_phones.digits`, unioned with `phone_digits(contacts.phone)`
  so rows written before the `contact_phones` migration are not invisible. Both
  sides indexed.
- **channel** — `channel_type || ':' || external_id`. Because
  `(channel_id, external_id)` is globally unique, this only groups contacts
  across *different channel rows of the same type* — two connected WhatsApp
  numbers, one customer. Narrow, but correct.
- **email** — `lower(btrim(email))` on non-null emails.

A pair matching several keys appears once, under its strongest reason
(phone 1 → channel 2 → email 3). Deduplication happens in an internal CTE, on the
sorted array of member ids ranked by reason; that array is not a returned column.
Ordering is by reason rank, then group size descending, then `group_key`, so
paging is a total order.

Group members come back inline in `contacts` as a jsonb array of
`{id, display_name, phone, email, avatar_url, status, source, last_seen_at,
conversation_count}` — one round trip rather than an id list the client then
re-fetches per group. `display_name` is computed exactly as
`search_workspace_contacts` and `list_archived_contacts` compute it, so a row
reads identically in all three views.

`p_limit` is clamped `least(greatest(coalesce(p_limit, 20), 1), 50)` and
`p_offset` floored at 0, matching the other directory RPCs.

### 6.4 `count_contact_merge_children`

```sql
public.count_contact_merge_children(p_workspace_id uuid, p_contact_id uuid)
  returns table (conversation_count integer, note_count integer,
                 phone_count integer, channel_count integer)
```

`SECURITY INVOKER`. What a merge would move off one contact, in one round trip,
so the confirmation in §7.3 can state exact numbers rather than a vague "and its
history". Both entry points get the same answer from the same place; assembling
it from four separate queries in the dialog would be four requests and two
different answers depending on which view opened it.

**Cost of the duplicate scan.** It is a group-by over the workspace's contacts, not a point lookup.
It is off the inbound hot path, it runs only while the duplicates view is open,
and it is fine at the ~100k scale that
`20260731170000_add_contact_owner_and_directory_indexes.sql` names as its revisit
point. It gets a real `staleTime` rather than a refetch per interaction.

## 7. Client

### 7.1 Files

```
src/features/contacts/
  api/contact-merges.ts            mergeContacts · listDuplicateGroups
  api/query-keys.ts                + duplicates(ws) · duplicatesPage(ws, page)
  hooks/use-duplicate-contacts.ts
  hooks/use-merge-contacts.ts
  model/merge-fields.ts            allowlist · conflict detection · survivor default · tag union
  model/merge-fields.test.ts
  ui/merge-contacts-dialog.tsx
  ui/duplicate-group-card.tsx
  ui/contact-selection-bar.tsx
  ui/directory-view.tsx            extracted from contacts-page.tsx
  ui/archived-view.tsx             extracted from contacts-page.tsx
  ui/duplicates-view.tsx
```

`contacts-page.tsx` is 432 lines and would gain a third view plus multi-select
state. It is split into the three view components above, leaving the page as
header, filters and a view switch. This is a boundary the feature actually
crosses, not unrelated refactoring.

RPC results are typed with hand-written Zod schemas at the API boundary, for the
reason documented on `ContactListItem`: Postgres `RETURNS TABLE` columns carry no
null information, so the generated types declare every one of them
non-nullable.

### 7.2 The duplicates view

`?duplicates=true` in the contacts route search, mutually exclusive with the
existing `?archived=true`, reached from a filter chip beside Архив carrying a
count badge when the count is non-zero. `ContactListPatch` gains `duplicates?:
boolean` alongside `archived?`, for the same reason `archived` lives there: it
selects an RPC rather than parameterising one.

Visible to every workspace member. The Merge action inside it is owner/admin
only, so a member can spot a duplicate and ask someone to resolve it. Each group
renders its contacts as a small stack with the match reason stated ("совпадает
номер телефона"), and a Merge button.

### 7.3 The dialog: one component, two steps

An earlier draft made the confirmation a separate `AlertDialog` layered over the
picker. Astryx forbids that outright — "Don't: Nest dialogs inside other dialogs;
restructure the flow into steps within a single dialog instead" (`astryx
component Dialog`) — and `AlertDialog` takes a plain string `description` and
could not host the picker anyway. So it is one `Dialog` with `purpose="form"`
(the backdrop must not discard a half-made choice) carrying two internal steps.
Separating *choose* from *commit* is preserved; only the mechanism changes.

`DialogHeader` supplies `startContent`, which carries the Back button on step 2.

**Step 1 — the picker.** A two-column comparison. The survivor is
pre-selected as the contact with the most conversations, tie-broken by the most
recent `last_seen_at`, and can be switched. Only fields that actually differ get
a radio pair; identical fields are shown once, and fields set on one side only
are filled silently. A fixed footer states what is always kept: phones, channels,
conversations, notes, and the union of tags. Its action button reads "Продолжить"
and commits nothing.

When the two contacts share a channel, the dialog says so and disables the
action — the user never reaches a confirmation that would fail. It does not name
the channel: `merge_contacts` does not return that identity, so the client has
nothing true to put there. The banner states the fact — both contacts have a
conversation on the same channel — without pretending to know which one.

**Step 2 — the confirmation.** The same dialog, its body replaced by a
`Banner status="error"` and a `variant="destructive"` action button, describing
the resolved outcome:

- which contact is merged into which, and that it goes to the archive
- the counts of what moves (phones, channels, conversations, notes)
- **only if the picker overwrites something**, which survivor fields change and
  from what to what
- that the action cannot be undone

The override paragraph is omitted entirely when nothing is overwritten. No fake
danger when nothing is being destroyed. Every number and value in it is computed
client-side from data the picker already loaded, so the confirmation is exact
rather than generic.

Back returns to step 1 with every choice intact.

### 7.4 Redirect and invalidation

The `/workspaces/$id/contacts/$contactId` loader reads `merged_into_id`; when set
it redirects to the survivor with `replace: true` and an info toast, so a stale
link or bookmark lands somewhere true instead of on a 404. If the survivor has
since been archived by ordinary means, the redirect still fires and the detail
route shows its existing not-found state — one hop, no chain-walking, and no
worse than opening any other archived contact by id.

A successful merge invalidates `contactQueryKeys.workspace(ws)` wholesale — the
directory pages, the archived list, the duplicates list and both details — plus
the inbox conversation-list keys, because conversations changed `contact_id`.
Anyone with the loser's thread open sees it move. This is broader than the
feature's usual invalidation and deliberately so.

## 8. Errors

| Raised | Shown |
|---|---|
| `NOT_A_WORKSPACE_ADMIN` (42501) | the existing not-an-admin message |
| `CONTACT_MERGE_CONVERSATION_CONFLICT` | a specific sentence stating the clash, without naming the channel — `merge_contacts` does not return that identity |
| `CONTACT_IS_MERGED` | only reachable if a stale archived list still shows Restore; a short "контакт объединён" |
| anything else | the generic merge-failed message |

No English fallback strings anywhere in the API layer.

## 9. Internationalization

Keys under `contacts_merge_*` and `contacts_duplicates_*`, in both
`messages/en.json` and `messages/ru.json`, checked against each other by hand —
nothing enforces key parity automatically.

- **Plural variants, not ternaries:** `contacts_duplicates_count`, the per-group
  member count, and each of the four "what moves" counts in the confirmation
  need Russian's `one` / `few` / `many`. `2 контакта` / `5 контактов` /
  `21 контакт` is three forms and no ternary yields three.
- **Width budgets** in `src/lib/message-lengths.test.ts` for every field label
  and both survivor labels in the picker: it is a fixed-width two-column control
  and Russian runs 15–30% longer than English.
- **Zod as a factory** if the picker carries a schema: `createMergeFieldsSchema()`
  through `useLocalizedSchema`. A module-level constant freezes whichever locale
  loaded first.
- Astryx ships no Russian catalogue; use the app's catalogue and
  `src/lib/field-label.ts` where a `Field` label is involved.

## 10. Testing

**`supabase/tests/database/contact_merge.test.sql`**

- a member is refused 42501; an owner and an admin succeed
- cross-workspace pair refused; self-merge refused; already-merged loser refused;
  archived contact on either side refused
- conversations, notes, channels and phones all land on the survivor
- a phone the survivor already holds collapses instead of raising 23505
- a shared-channel pair raises `CONTACT_MERGE_CONVERSATION_CONFLICT` and the
  whole transaction rolls back — nothing moved
- **the moved conversations are not archived by `trg_cascade_contact_archive`.**
  This is the ordering hazard §6.1 step 8 exists to prevent, so it gets a test
  rather than a comment
- `merged_at` and `merged_by` record the acting admin
- the survivor's overwritten fields hold the picked values; the loser's own
  scalars are untouched
- `p_fields` naming a column outside the allowlist raises
  `CONTACT_MERGE_UNKNOWN_FIELD` and changes nothing — refusing beats silently
  dropping a key the caller believed in, and it is the easier thing to test
- `p_fields` with an invalid `status`, `source`, or a non-member `owner_id` is
  rejected
- `contacts_merged_is_archived_check` rejects a merged row with `deleted_at is null`
- `restore_contact` on a merged contact raises `CONTACT_IS_MERGED`

**`list_duplicate_contact_groups` tests**

- archived and merged rows excluded
- a pair matching on both phone and email appears once, under `phone`
- another workspace's duplicates are invisible under RLS
- legacy rows with only `contacts.phone` and no `contact_phones` row still group

**Unit** — `merge-fields.test.ts`: conflict detection, survivor default and its
tie-break, tag union, allowlist rejection of unknown keys.

**Component** — the picker renders only conflicting fields; the action is
disabled with a named channel on a clash; the confirmation omits the override
paragraph when nothing is overwritten.

**Manual** — Russian, phone width, real browser. jsdom has no layout, so the
two-column picker's overflow is invisible to the unit suite.

Validation: `pnpm typecheck` and `pnpm test` at minimum, `pnpm test:db` for the
migration, and `pnpm verify` before the PR. Local Supabase is shared across
worktrees, so `test:db` must not run concurrently with another worktree's.

## 11. Risks

- **The merge is one-way.** Mitigated by the confirmation naming the exact
  overwritten fields, by the loser's row surviving intact in the archive, and by
  the owner/admin gate — but a wrong merge still costs the survivor's overwritten
  scalars, and re-splitting the records is manual.
- **The duplicate scan is a full group-by** over the workspace's contacts. Fine
  now; worth watching as workspaces grow, and the first thing to reach for if the
  duplicates view feels slow.
- **Realtime staleness.** A teammate with the loser's conversation open has a
  thread whose `contact_id` changed underneath them. The broad invalidation in
  §7.4 covers the acting user; other sessions rely on the existing conversation
  realtime path noticing the update.
- **`contact_phones` position renumbering** is the fiddliest step in the RPC and
  the easiest place to leave the primary number wrong. It carries its own test.

## 12. Follow-ups, not part of this work

1. Fold two conversations that share a channel, replacing the §4.3 refusal.
2. Deterministic fuzzy scoring — blocking keys plus weighted rules over the
   existing trigram indexes, with certain/likely/weak bands. Tunable only once
   real merge data exists.
3. N-way merge for groups larger than two.
