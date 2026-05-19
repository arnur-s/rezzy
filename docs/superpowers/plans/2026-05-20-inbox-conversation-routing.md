# Inbox Conversation URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each conversation a shareable URL (`/workspaces/{id}/inbox/{conversationId}`) by converting the inbox route into a layout with two minimal child routes, replacing `selectedId` state with URL params.

**Architecture:** `inbox.tsx` becomes a layout route that reads `conversationId` from the active child URL via `useParams({ strict: false })` and passes navigation callbacks into `InboxPage`. Two child routes (`inbox/index.tsx` and `inbox/$conversationId.tsx`) register the URL shapes and render `null` — all visual content stays in the parent layout.

**Tech Stack:** TanStack Router (file-based routing, `useParams`, `useNavigate`), React, TypeScript

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/routes/_authenticated/workspaces/$id/inbox.tsx` |
| Modify | `src/features/inbox/components/inbox-page.tsx` |
| Create | `src/routes/_authenticated/workspaces/$id/inbox/index.tsx` |
| Create | `src/routes/_authenticated/workspaces/$id/inbox/$conversationId.tsx` |

---

## Task 1: Create the two child route stubs

These files register the URL shapes. They render `null` — the parent layout handles all visual output.

**Files:**
- Create: `src/routes/_authenticated/workspaces/$id/inbox/index.tsx`
- Create: `src/routes/_authenticated/workspaces/$id/inbox/$conversationId.tsx`

- [ ] **Step 1: Create `inbox/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox/')({
  component: () => null,
})
```

- [ ] **Step 2: Create `inbox/$conversationId.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/inbox/$conversationId',
)({
  component: () => null,
})
```

- [ ] **Step 3: Verify TanStack Router picks up the new files**

Run the dev server briefly (`pnpm dev`) to let the Vite plugin regenerate the route tree, then stop it. If you skip this, `pnpm typecheck` may fail on stale route tree types.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_authenticated/workspaces/$id/inbox/index.tsx
git add "src/routes/_authenticated/workspaces/$id/inbox/\$conversationId.tsx"
git add src/routeTree.gen.ts
git commit -m "feat(inbox): add conversation URL route stubs"
```

---

## Task 2: Refactor `InboxPage` to accept navigation props

Replace `selectedId` state and `mobilePane` state with props driven from the URL. The component no longer owns navigation — it receives callbacks from the route.

**Files:**
- Modify: `src/features/inbox/components/inbox-page.tsx`

- [ ] **Step 1: Replace the file contents**

Full replacement (no other files change in this task):

```tsx
import { useRecordWorkspaceVisit } from '@/features/dashboard/hooks/use-record-recent-visit'
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@heroui/styles'
import { useMemo, useState } from 'react'
import { useConversations } from '../hooks/use-conversations'
import { useConversationsRealtime } from '../hooks/use-conversations-realtime'
import { ContactPanel } from './contact-panel/contact-panel'
import type { InboxPrimaryFilter } from './conversation-list/conversation-list'
import { ConversationList } from './conversation-list/conversation-list'
import { MessageThread } from './message-thread/message-thread'

type MobilePane = 'list' | 'thread' | 'contact'

type Props = {
  workspaceId: string
  selectedConversationId: string | null
  onSelectConversation: (id: string) => void
  onBackToList: () => void
}

export function InboxPage({
  workspaceId,
  selectedConversationId,
  onSelectConversation,
  onBackToList,
}: Props) {
  const { session } = useAuth()
  const senderId = session?.user.id ?? null

  const conversationsQuery = useConversations(workspaceId)
  useConversationsRealtime(workspaceId)

  const workspacesQuery = useWorkspaces(senderId ?? undefined)
  const workspace = workspacesQuery.data?.find((w) => w.id === workspaceId)
  useRecordWorkspaceVisit(workspaceId, workspace?.name)

  const [primaryFilter, setPrimaryFilter] = useState<InboxPrimaryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false)

  const selectedConversation = useMemo(
    () =>
      conversationsQuery.data?.find((row) => row.id === selectedConversationId) ??
      null,
    [conversationsQuery.data, selectedConversationId],
  )

  const mobilePane: MobilePane =
    isContactPanelOpen && selectedConversation !== null
      ? 'contact'
      : selectedConversationId !== null
        ? 'thread'
        : 'list'

  function handleToggleContactPanel() {
    if (!selectedConversation) return
    setIsContactPanelOpen((open) => !open)
  }

  function handleCloseContactPanel() {
    setIsContactPanelOpen(false)
  }

  const showContact = isContactPanelOpen && selectedConversation !== null

  // Grid template:
  // - mobile (<md): single column; we hide the inactive panes via classes
  // - md (≥768): list 20rem | thread fills rest
  // - lg (≥1024) with contact open: list 20rem | thread fills rest | contact 20rem
  const gridClass = showContact
    ? 'md:grid-cols-[20rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)_20rem]'
    : 'md:grid-cols-[20rem_minmax(0,1fr)]'

  return (
    <div
      className={cn(
        'grid h-full min-h-0 w-full grid-cols-1 grid-rows-1',
        gridClass,
      )}
    >
      {/* List pane */}
      <div
        className={cn(
          'h-full min-h-0 min-w-0 overflow-hidden',
          mobilePane === 'list' ? 'block' : 'hidden',
          'md:block',
        )}
      >
        <ConversationList
          conversations={conversationsQuery.data}
          isLoading={conversationsQuery.isPending}
          isError={conversationsQuery.isError}
          selectedConversationId={selectedConversationId}
          onSelect={onSelectConversation}
          primaryFilter={primaryFilter}
          onPrimaryFilterChange={setPrimaryFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userId={senderId}
        />
      </div>

      {/* Thread pane.
          On md without contact panel: visible.
          On md with contact panel open: hidden (panel takes its slot).
          On lg+: always visible. */}
      <div
        className={cn(
          'h-full min-h-0 min-w-0 overflow-hidden',
          mobilePane === 'thread' ? 'block' : 'hidden',
          showContact ? 'md:hidden lg:block' : 'md:block',
        )}
      >
        <MessageThread
          workspaceId={workspaceId}
          conversation={selectedConversation}
          senderId={senderId}
          onToggleContactPanel={handleToggleContactPanel}
          onBack={onBackToList}
        />
      </div>

      {/* Contact panel pane. */}
      {isContactPanelOpen && selectedConversation ? (
        <div
          className={cn(
            'h-full min-h-0 min-w-0 overflow-hidden',
            mobilePane === 'contact' ? 'block' : 'hidden',
            // On md it slots into column 2 (replacing the thread).
            // On lg+ it slots into column 3.
            'md:block',
          )}
        >
          <ContactPanel
            workspaceId={workspaceId}
            conversation={selectedConversation}
            onClose={handleCloseContactPanel}
          />
        </div>
      ) : null}
    </div>
  )
}
```

> **Note:** This breaks the build temporarily — `inbox.tsx` still passes the old props. Fixed in Task 3.

---

## Task 3: Update `inbox.tsx` to a layout route

Read `conversationId` from the URL, provide navigation callbacks, add `<Outlet />`.

**Files:**
- Modify: `src/routes/_authenticated/workspaces/$id/inbox.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { InboxPage } from '@/features/inbox/components/inbox-page'
import { workspaceCrumbs } from '@/lib/breadcrumbs'
import { m } from '@/paraglide/messages'
import { Outlet, createFileRoute, useNavigate, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox')({
  component: RouteComponent,
  staticData: {
    crumb: (ctx) => [...workspaceCrumbs(ctx), { label: m.breadcrumbs_inbox() }],
  },
})

function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  const allParams = useParams({ strict: false }) as Record<string, string | undefined>
  const selectedConversationId = allParams.conversationId ?? null
  const navigate = useNavigate()

  function handleSelectConversation(conversationId: string) {
    void navigate({
      to: '/workspaces/$id/inbox/$conversationId',
      params: { id: workspaceId, conversationId },
    })
  }

  function handleBackToList() {
    void navigate({
      to: '/workspaces/$id/inbox',
      params: { id: workspaceId },
    })
  }

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col">
      <InboxPage
        workspaceId={workspaceId}
        selectedConversationId={selectedConversationId}
        onSelectConversation={handleSelectConversation}
        onBackToList={handleBackToList}
      />
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If you see errors about the route tree not knowing `$conversationId`, run `pnpm dev` briefly first to regenerate `routeTree.gen.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_authenticated/workspaces/$id/inbox.tsx
git add src/features/inbox/components/inbox-page.tsx
git commit -m "feat(inbox): route conversations by URL segment"
```

---

## Task 4: Manual verification

No automated tests exist for `InboxPage` or the route integration — verify behaviour manually.

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify base URL shows empty state**

Navigate to `http://localhost:3000/workspaces/{any-workspace-id}/inbox`.

Expected:
- Conversation list visible on the left.
- Empty thread placeholder on the right.
- URL stays at `/inbox` (no extra segment).

- [ ] **Step 3: Verify conversation selection updates URL**

Click a conversation in the list.

Expected:
- URL changes to `/workspaces/{id}/inbox/{conversationId}`.
- Thread pane shows that conversation's messages.
- Conversation is highlighted in the list.

- [ ] **Step 4: Verify deep link**

Copy the URL from Step 3, open a new tab, paste it.

Expected:
- Correct conversation loads directly.
- List pane shows the correct highlighted item.

- [ ] **Step 5: Verify browser back navigation**

After selecting a conversation, press the browser Back button.

Expected:
- URL returns to `/workspaces/{id}/inbox`.
- Empty thread state is shown.

- [ ] **Step 6: Verify mobile back button**

Resize browser to < 768px, select a conversation (shows thread pane), tap the back button in the thread header.

Expected:
- Returns to the list pane.
- URL returns to `/workspaces/{id}/inbox`.

- [ ] **Step 7: Verify contact panel still works**

Select a conversation, open the contact panel (toggle button in thread header), close it.

Expected:
- Contact panel opens and closes correctly.
- URL does not change when toggling the contact panel.

- [ ] **Step 8: Run lint**

```bash
pnpm lint
```

Expected: no errors.
