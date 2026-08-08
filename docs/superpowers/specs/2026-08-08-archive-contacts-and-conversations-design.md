# Archive contacts and conversations instead of deleting them

Design notes. Nothing here is implemented yet.

## What is there now

`public.contacts` and `public.conversations` each carry an admin-only DELETE
policy, added in the `20260515130754_remote_schema.sql` snapshot and re-stated
with a pinned `(select auth.uid())` in `20260720093622`:

```sql
create policy "Workspace admins can delete contacts"
  on public.contacts for delete to authenticated
  using (exists (select 1 from public.workspace_members wm
                 where wm.workspace_id = contacts.workspace_id
                   and wm.user_id = (select auth.uid())
                   and wm.role = any (array['owner', 'admin'])));
```

`authenticated` also holds the table-level DELETE grant on both tables
(`20260720090850`, lines 82 and 85), so the policy is reachable from PostgREST.

Both inbound foreign keys are NO ACTION:

- `conversations.contact_id → contacts(id)`, from
  `20260509120000_create_inbox_core_tables.sql`.
- `messages (workspace_id, conversation_id) → conversations (workspace_id, id)`,
  restated as a composite in `20260804100300` with no `on delete` clause.

### Why it is wrong

The two facts compose into a policy that only works on records nobody wants to
remove. Deleting a contact that has ever held a conversation raises 23503, and
so does deleting a conversation that has ever held a message. A brand-new
mistyped contact deletes cleanly; a real customer never does. The failure is
also silent in intent — a foreign-key violation surfacing in a UI that offered a
delete button reads as a bug, not as a policy.

Making the FKs cascade is not the fix. Message history is the product; a delete
that removes the record of what a customer said and what the team answered
destroys the thing the inbox exists to hold. The FKs stay restrictive and
"delete" stops meaning destroy.

One correction to the brief that motivated this work: **the UI cannot reach
those policies today.** The only `.delete()` calls in `src/` are
`contact-notes.ts:99` and `push-subscriptions.ts:35`. `soft_delete_workspace`
exists in the schema and is called from nowhere either. So the UI work below is
new affordances, not replacements.

## Scope: archive, not erasure

Decided explicitly, and worth recording because it is the kind of thing a reader
will otherwise assume was an oversight.

**No PII is scrubbed.** An archived contact keeps `name`, `phone`, `email`,
`avatar_url`, `notes`, its `contact_phones` rows, its `contact_channels`
external identity, and every message verbatim. Archiving hides rows; it does not
alter them.

The consequence, stated plainly: **an erasure request has no product answer
after this work.** Adding one later means a second operation that scrubs the
contact-level fields and the channel identity — and it is easier to add on top
of `deleted_at` than to retrofit. It is not in this spec.

That choice also makes auto-unarchive (below) coherent. Because
`contact_channels.external_id` is never scrubbed, the inbound webhook path still
resolves a returning customer to their existing contact. Under an anonymizing
design it could not, and "restore" could never reunite the person with their
history.

A second, narrower consequence: messages belonging to an archived conversation
stay readable by any workspace member who knows a message id, because the
`messages` SELECT policy is membership-scoped and gains no join to
`conversations`. This is deliberate — the join would sit on the hottest query in
the product to protect rows the same member could read a moment earlier. No UI
path leads there, since the conversation itself is invisible.

## Target shape

### 1. Columns

`deleted_at timestamptz` on both tables, nullable, no default — the shape
`workspaces` already uses. Partial indexes on the two hot paths only:

```sql
create index idx_conversations_workspace_last_message_live
  on public.conversations (workspace_id, last_message_at desc)
  where deleted_at is null;

create index idx_contacts_workspace_live
  on public.contacts (workspace_id)
  where deleted_at is null;
```

The remaining indexes on both tables keep working unchanged; archived rows are a
small tail and do not justify a partial variant of every one.

### 2. RLS is the only filter

Both SELECT policies gain `deleted_at is null`, for **everyone, admins
included**:

```sql
alter policy "Workspace members can view contacts" on public.contacts
  using (deleted_at is null and public.is_workspace_member(workspace_id));

alter policy "Workspace members can view conversations" on public.conversations
  using (deleted_at is null and public.is_workspace_member(workspace_id));
```

Both UPDATE policies gain the same predicate in `USING`, so an archived contact
cannot be edited into an inconsistent state while hidden.

Because the exclusion lives in the policy, every reader inherits it with no code
change: `search_workspace_contacts` and `match_workspace_contacts` (both
SECURITY INVOKER), `get_workspace_unread_counts` (SECURITY INVOKER),
`getWorkspaceConversations`, `getWorkspaceConversationsBySearch`,
`getConversationById`, `getAttentionQueue`, and `getHomeStats`.

**Work item 4 of the brief therefore needs no query edits.** Adding
`.is('deleted_at', null)` to each read path would be a second copy of the
invariant, free to drift from the first and from every read path added later.
The one place that does need work is realtime (§6).

`create_message_notifications` is SECURITY DEFINER and so bypasses RLS, but
needs no guard either — see §5.

### 3. The DELETE policies go away

```sql
drop policy "Workspace admins can delete contacts" on public.contacts;
drop policy "Workspace admins can delete conversations" on public.conversations;
revoke delete on table public.contacts from authenticated;
revoke delete on table public.conversations from authenticated;
```

This is what makes "deletion means archival" literally true rather than a
convention. `messages` keeps its admin DELETE policy: making message history
strictly append-only is a larger decision than this work, and blocking future
moderation tooling is not something to do as a side effect.

### 4. Three RPCs and one trigger

Modelled on `soft_delete_workspace`: SECURITY DEFINER, empty search path,
explicit owner/admin check, `returns void`.

- **`archive_contact(p_contact_id uuid)`** — stamps `deleted_at = now()`.
  Definer rather than a PostgREST update because the row leaves the caller's own
  view the instant it is stamped, so `.update().select()` would fail on the
  returning read.
- **`restore_contact(p_contact_id uuid)`** — clears `deleted_at`.
- **`list_archived_contacts(p_workspace_id uuid, p_query text, p_limit int,
  p_offset int)`** — the one guarded hole through the SELECT policy, admin-only,
  returning enough to render a row and a Restore button. Same shape of narrow
  exception as `list_workspace_members`.

Authority is owner/admin, matching what the dropped DELETE policies granted, so
this is a like-for-like replacement and not a widening.

The cascade is a trigger, not a step in the RPC:

```sql
create trigger trg_cascade_contact_archive
  after update of deleted_at on public.contacts
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function public.cascade_contact_archive();
```

It stamps or clears `deleted_at` on every conversation of that contact in the
same transaction. Anything that changes `contacts.deleted_at` — this RPC, a
future one, a service-role write, a manual fix — cannot leave visible threads
hanging off an invisible contact.

`cascade_contact_archive()` must hold definer rights, and so must
`unarchive_on_inbound_message()` in §5. A trigger function otherwise runs as the
invoking user, and the restore direction updates rows that the tightened UPDATE
policy (`using (deleted_at is null …)`) forbids that user from touching — an
invoker-rights trigger would archive correctly and then silently fail to
restore. Both functions take `set search_path = ''` and read only the row they
were handed, so definer rights widen nothing.

Conversations are never archivable on their own: the inbox exposes no
per-conversation archive action, because `status = 'closed'` already means "done
with this thread" and a second, near-identical hide action makes agents guess.
So a contact and its threads always share one state, and restore is unambiguous
— there is no set of "already hidden before the archive" threads to remember.

### 5. Auto-unarchive on inbound

A returning customer un-hides themselves:

```sql
create trigger trg_unarchive_on_inbound_message
  before insert on public.messages
  for each row
  execute function public.unarchive_on_inbound_message();
```

If `new.direction = 'inbound'` and the conversation is archived, clear
`deleted_at` on the conversation and on its contact.

BEFORE, not AFTER, and the reason is load-bearing. Postgres fires AFTER triggers
in name order, and the existing set on `messages` is
`trg_apply_latest_message_status`, `trg_auto_assign_conversation_on_outbound_message`,
`trg_create_message_notifications`, `trg_handle_inbound_message_insert`,
`trg_handle_outbound_message_insert`. An AFTER trigger would sort after
`trg_create_message_notifications` unless given a deliberately ugly name prefix,
and the notification would then be created against a still-archived
conversation. Every BEFORE trigger runs ahead of every AFTER trigger regardless
of name, so the ordering holds without depending on alphabetical luck.

This is also why `create_message_notifications` needs no `deleted_at` guard
despite being SECURITY DEFINER: by the time it runs, nothing is archived.
Unread counts need none either, since `get_workspace_unread_counts` is invoker
and RLS has already dropped archived rows.

The alternative — archived threads that silently swallow inbound messages — is
the exact failure the inbox exists to prevent.

### 6. Realtime, and one honest limitation

Supabase evaluates RLS per subscriber for `postgres_changes`. When an admin
archives, the updated row is invisible to other members, so **their clients
receive no UPDATE event at all** and keep a stale row until the next refetch.
The filter syntax cannot express `deleted_at is null` in any case, and only one
filter is allowed per subscription — `workspace_id` already holds it
(`use-conversations-realtime.ts:31`).

Three mitigations, in order of effect:

1. The acting admin's client invalidates
   `inboxQueryKeys.conversations(workspaceId)` on success, so the person who
   archived sees it leave immediately.
2. The UPDATE handler drops rather than merges any row arriving with a non-null
   `deleted_at`. This covers admins, who do receive the event.
3. A member who opens a stale row lands on the existing
   `inbox_thread_unavailable_description` state, which exists for exactly this
   case.

A broadcast channel would close the gap fully. It is not worth a new realtime
surface for a rare, admin-only action whose worst outcome is a row that
disappears on the next refetch.

### 7. UI

**Contact detail** (`contact-detail-page.tsx`) — Archive in the header menu,
rendered only for owner/admin, behind a confirmation dialog. On success, the
route redirects to the contacts list, since the contact it was showing no longer
resolves.

**Contacts directory** (`contacts-page.tsx`) — an *Archived* entry in the
existing filter bar, visible only to owner/admin, switching the list to
`list_archived_contacts`. Each row offers Restore. There is no archived detail
page: an archived contact has a row and a way back, nothing more.

**Inbox** — no new affordance. Archived conversations simply stop appearing.

### 8. Copy

All strings through Paraglide, in `messages/ru.json` and `messages/en.json`,
`ru` first as the base locale.

The confirmation dialog names the conversation count, which makes it a counted
string and therefore a plural variant with `one` / `few` / `many` — never a
ternary in TypeScript, which cannot produce three forms. The count comes from
the contact's conversations, already loaded on the detail page by
`contact-conversations.ts`. Add a budget in `src/lib/message-lengths.test.ts`
for any of these that sits in a fixed-width control.

The copy must not promise the customer is gone. By §5 an archived contact
reappears the moment they write in, so the Russian has to read as *скрыть из
списков* rather than *удалить* — otherwise the first auto-unarchive reads as a
bug. The dialog should say what archiving does (hides the contact and its
conversations from lists, keeps the history) and that it can be undone.

Keys, grouped under the existing `contact_` prefix:

`contact_archive_action`, `contact_archive_title`,
`contact_archive_description` (counted), `contact_archive_confirm`,
`contact_archived_toast`, `contact_archive_error`, `contact_restore_action`,
`contact_restored_toast`, `contact_restore_error`,
`contacts_filter_archived`, `contacts_archived_empty`.

## Migration path

Three migrations, dated `2026-08-08`, none rewriting existing history:

1. `20260808090000_contacts_and_conversations_deleted_at.sql` — columns,
   partial indexes, SELECT/UPDATE policy changes, the dropped DELETE policies
   and grants, the cascade trigger.
2. `20260808090100_contact_archive_rpcs.sql` — `archive_contact`,
   `restore_contact`, `list_archived_contacts`, with `revoke all` /
   `grant execute to authenticated` following the house pattern.
3. `20260808090200_unarchive_on_inbound_message.sql` — the BEFORE INSERT
   trigger.

Then `pnpm types:supabase:local` to regenerate `src/api/types.ts`.

Application changes:

- `src/features/contacts/api/contacts.ts` — `archiveContact`, `restoreContact`,
  `listArchivedContacts`.
- `src/features/contacts/hooks/use-contacts.ts` — the matching mutations and
  the archived-list query, invalidating both the contacts list and
  `inboxQueryKeys.conversations`.
- `src/features/contacts/ui/` — menu item, confirmation dialog, filter entry,
  Restore row action.
- `src/features/inbox/hooks/use-conversations-realtime.ts` — drop archived rows
  in the UPDATE handler.

No changes to the dashboard or inbox query files.

## Testing

New pgTAP file `supabase/tests/database/contact_archive.test.sql`:

- An archived contact is invisible to a member SELECT, and to an *admin* SELECT.
- Archiving a contact archives its conversations in the same statement, and
  those conversations are invisible to a member SELECT.
- `search_workspace_contacts` and `match_workspace_contacts` omit archived
  contacts; `list_archived_contacts` returns them for an admin and raises for a
  member.
- A member calling `archive_contact` raises 42501.
- A direct `delete from public.contacts` by an admin is now rejected.
- An inbound message insert on an archived conversation clears `deleted_at` on
  both the conversation and the contact, and the resulting
  `message_notifications` row exists.
- `restore_contact` restores the contact and its conversations together.

Vitest: the realtime UPDATE handler drops a row stamped with `deleted_at`;
the archive mutation invalidates both query keys; plural forms for the counted
dialog string are pinned in `src/lib/message-plurals.test.ts`.

Acceptance runs `pnpm test:db`, `pnpm test`, `pnpm typecheck`. `test:db` needs a
local Supabase (Docker); if it cannot start, that gets reported, not skipped
past. jsdom has no layout, so the confirmation dialog is checked in a real
browser at phone width in Russian before this is called done.

## As built

Four things the implementation needed that this design did not anticipate.

**An exact conversation count.** `listContactConversations` caps at five, so its
length would have told somebody with twelve threads that they had five. The
dialog reads `countContactConversations`, a `head: true` exact count, fetched
only while the dialog is open. While it is in flight the dialog shows
`contact_archive_description_none` — true either way, just less specific —
rather than rendering the counted sentence against a placeholder zero.

**`useIsWorkspaceAdmin`.** Both contact surfaces need the caller's role, and
`useWorkspaceMemberDirectory` already carries it, so this derives from the
cached roster instead of adding a query. It gates affordances only; the RPCs
enforce the same rule again.

**The unarchive direction in realtime.** §6 covered archiving. The reverse — an
inbound message clearing `deleted_at` — makes a row visible that the client has
never seen, so a merge-by-id would silently do nothing and the returning
customer's conversation would stay missing until a refetch. The UPDATE handler
now checks the cache and fetches the conversation like a new one when it is
absent.

**`archived` in the URL, not in `ContactListParams`.** That type maps field for
field onto `search_workspace_contacts`, which has no such argument. It travels
as `ContactListPatch` instead. A member who lands on `?archived=true` is put
back on the directory once the roster has loaded.

## Risks

- **Stale conversation rows for non-acting members** (§6). Accepted and
  documented; worst case is a row that vanishes on refetch.
- **`is_workspace_member` is unchanged.** Archiving is per-contact, so unlike
  the workspace soft delete there is no single predicate every child table
  already authorises through. The cascade trigger covers `conversations`;
  `contact_channels`, `contact_phones` and `contact_notes` keep their own
  policies and stay readable for an archived contact. Nothing in the UI reaches
  them, because every path starts from a contact or conversation row that is now
  hidden.
- **Restore does not re-run any side effect.** A restored conversation returns
  with whatever `status`, `assigned_to` and read cursors it had. That is the
  intent, but it means a conversation archived while unread comes back unread.
