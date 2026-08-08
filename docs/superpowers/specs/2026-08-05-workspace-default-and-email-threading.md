# Two structural constraints to unwind

Design notes only. Nothing here is implemented, and neither change ships with
the 2026-08-05 permissions work — both alter a contract that live code depends
on, and each deserves its own migration and its own review.

Both were found while tightening write permissions; both are cases where a
constraint that was correct for a single-user, single-channel product is now the
thing blocking a workflow the product already claims to support.

---

## 1. `is_main` is a global flag, not a per-member default

### What is there now

`public.workspaces.is_main boolean not null default false`, with

```sql
one_main_workspace_per_user unique (created_by) where is_main = true
                                                 and deleted_at is null
```

The uniqueness key is `created_by`. So "main" is a property of the workspace,
scoped to whoever created it — not a property of the relationship between a user
and a workspace.

Writers and readers today:

- `complete_onboarding()` creates the first workspace with `is_main = true`, and
  the partial index is the concurrency guard that makes a double submission
  return the existing workspace instead of creating a second one.
- `useCreateWorkspace` (`src/features/workspaces/hooks/use-workspaces.ts`)
  passes `isMain: !hasMainWorkspace`, where `hasMainWorkspace` is computed from
  the caller's own workspace list.
- `getUserWorkspaces()` orders `is_main desc, created_at asc`, and
  `complete_onboarding()` repeats that ordering so the RPC and the UI agree on
  which workspace the app lands on.

### Why it is wrong

An invited user can belong to several workspaces, each marked main by a
different creator. `order by is_main desc` then has several rows tied at `true`
and falls through to `created_at asc` — so an invited user's landing workspace is
whichever of their workspaces happens to be oldest, and it changes when they are
invited to an older one. Nothing the user does can express "this is the one I
start in", because the flag they would need to set belongs to the creator.

The second problem is `!hasMainWorkspace` in the client: a user who is a member
of somebody else's main workspace but has created none of their own computes
`hasMainWorkspace = true`, so their first *own* workspace is created with
`is_main = false` and never becomes their default.

### Target shape

A default is per user, so it belongs on the membership:

```sql
alter table public.workspace_members
  add column is_default boolean not null default false;

create unique index one_default_workspace_per_member
  on public.workspace_members (user_id)
  where is_default = true;
```

`workspaces.is_main` then has no reason to exist.

### Migration path

1. **Add the column and index** as above. Do not touch `workspaces.is_main` in
   the same migration; the two coexist for one release.
2. **Backfill**, in this order, so every user ends with exactly one default:
   - the membership whose workspace has `is_main = true` and
     `created_by = workspace_members.user_id` (the creator's own main);
   - failing that, the member's oldest membership by `workspace_members.created_at`.
   Assert afterwards that `count(*) = count(distinct user_id)` over
   `workspace_members where is_default`, and raise if not — the same shape as
   the backfill assertions in `20260722120000_instagram_channel.sql`.
3. **Grant** `update (is_default)` on `workspace_members` to `authenticated`
   (the table currently has `select, insert` only), and add an RLS update policy
   restricted to `user_id = (select auth.uid())`: choosing a default is a
   personal setting, not an admin one. Setting one must clear the previous one —
   the partial unique index makes a naive update fail, so this wants a
   `set_default_workspace(uuid)` RPC that clears and sets in one statement
   rather than two client round trips.
4. **Move the trigger contract**: `handle_new_workspace()` seats the creator as
   owner; it should also set `is_default` when that user has no default yet.
   `complete_onboarding()` stops writing `is_main` and relies on the trigger.
5. **Replace the concurrency guard.** This is the step that must not be rushed:
   `one_main_workspace_per_user` is what makes concurrent onboarding submissions
   collapse into one workspace, and `complete_onboarding()`'s
   `unique_violation` handler is written against it. The new
   `one_default_workspace_per_member` index gives the same protection only if
   the membership insert happens inside the same transaction as the workspace
   insert — which it does, via `on_workspace_created`. Re-point the handler at
   the membership and re-run `onboarding.test.sql`, which pins the
   duplicate-submission behaviour in six assertions.
6. **Read paths**: `getUserWorkspaces()` orders by the joined
   `workspace_members.is_default desc, workspaces.created_at asc`. Because
   `workspace_members` is own-row-only under RLS, the join adds no visibility.
7. **Drop `workspaces.is_main`** in a later migration, once no read path
   references it. It appears in `src/api/types.ts` and in seven test fixtures,
   so the drop is a mechanical but wide diff — worth keeping separate.

### Risks

- Between steps 1 and 7 both flags exist; any code that writes one and reads the
  other is a bug for a release. Keep the window short.
- `complete_onboarding()` is the only thing standing between a double-clicked
  onboarding form and two workspaces. Step 5 is the whole risk of this change.

---

## 2. One conversation per contact per channel blocks email threads

### What is there now

```sql
conversations_contact_channel_unique unique (contact_id, channel_id)
```

and, in `supabase/functions/_shared/persist.ts`, `resolveConversation()` looks
up an existing conversation by exactly that pair and reuses it, creating one
only when none exists. So the constraint is not the only enforcement — the
resolver would reuse a single thread even without it.

`conversations.external_thread_id` already exists (added by
`20260723090200_extend_channel_identity_columns.sql`) and is populated on create
with `args.externalThreadId ?? args.externalId`. For the chat channels those two
are the same thing, so today the column holds the contact's channel identity
rather than a thread identity.

`'email'` is already in `channels_type_check`, so this is a forward-looking
block rather than a hypothetical one.

### Why it is wrong

Email is not a continuous stream keyed by the correspondent. One person opens
several threads, each with its own subject and its own `Message-ID`/
`In-Reply-To` chain, and replying to the wrong one is a visible mistake to the
customer. Collapsing every message from an address into one conversation also
destroys the only grouping an email UI has.

The chat channels genuinely are one-thread-per-contact: WhatsApp, Telegram and
Instagram Direct each give a single conversation per correspondent per account,
and their webhooks carry no thread identifier to key on. So the constraint is
right for three of the four channel types and wrong for the fourth.

### Target shape

Key the uniqueness on the thread, and let the thread identity be null for
channels that have none:

```sql
alter table public.conversations
  drop constraint conversations_contact_channel_unique;

-- Chat channels: still exactly one conversation per contact per channel.
create unique index conversations_contact_channel_single_thread
  on public.conversations (contact_id, channel_id)
  where external_thread_id is null;

-- Threaded channels: one conversation per thread.
create unique index conversations_contact_channel_thread
  on public.conversations (contact_id, channel_id, external_thread_id)
  where external_thread_id is not null;
```

Two partial indexes rather than one nullable-column index, because in Postgres
`null` is distinct from `null` in a unique index: a single
`unique (contact_id, channel_id, external_thread_id)` would silently permit
unlimited duplicate chat conversations, which is the exact regression this pair
of indexes exists to prevent.

### Migration path

1. **Stop writing a fake thread id first.** `resolveConversation()` currently
   defaults `external_thread_id` to the contact's `external_id`. Under the new
   indexes that value decides which index a row lands in, so it must become
   null for the chat channels before the indexes are created. This is an Edge
   Function deploy, and it has to precede the migration.
2. **Backfill**: `update public.conversations set external_thread_id = null`
   for rows whose channel type is not `'email'` and whose
   `external_thread_id` equals the contact's `contact_channels.external_id` —
   i.e. rows carrying the placeholder rather than a real thread. Count the rows
   that do not match either shape and raise if any remain, rather than guessing.
3. **Swap the constraint for the two indexes**, as above.
4. **Change the resolver**: `resolveConversation()` takes an optional thread
   identity and looks up `(contact_id, channel_id, external_thread_id)` when it
   has one, `(contact_id, channel_id) where external_thread_id is null` when it
   does not. The email ingest derives the thread identity from
   `References`/`In-Reply-To`, falling back to a normalized subject, and never
   from the sender address alone.
5. **Client**: the inbox lists conversations, so a contact with several threads
   simply appears several times — no schema-level change. What does need design
   is the contact panel, which currently assumes one conversation per contact
   per channel when it links from a contact to a thread.

### Risks

- Step 1 before step 3, in that order, across a deploy boundary. The reverse
  order leaves every existing chat conversation in the `is not null` index,
  where a second row for the same contact is permitted.
- `messages`, `message_notifications`, `message_reactions` and
  `conversation_reads` all reference `conversations (workspace_id, id)`, which
  this change does not touch. Nothing needs to move.
- Per-agent unread is derived from `conversation_reads` per conversation, so a
  contact with four email threads produces four unread cursors. That is correct
  but changes what the unread badge counts; check
  `get_workspace_unread_counts` before shipping.
