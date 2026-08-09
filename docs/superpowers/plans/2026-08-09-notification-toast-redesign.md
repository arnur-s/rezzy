# Notification Toast Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the in-app message toast to avatar, name, preview, and relative time; make the toast body itself the navigation target; and group consecutive messages from one conversation into a single toast that expands on hover or tap.

**Architecture:** A module-level store accumulates the messages currently represented by each conversation's live toast. `showMessageNotificationToast` appends to that store and re-shows the toast with the whole group, relying on Astryx's `collisionBehavior: 'overwrite'` to swap the entry in place. The toast body renders the newest message always, older messages inside a `grid-template-rows` region that expands on hover or via a count chip, and an absolutely positioned overlay button that navigates.

**Tech Stack:** React 19, TypeScript, Astryx (`@astryxdesign/core@0.1.8`), Tailwind CSS 4.1.18, Paraglide/Inlang, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-09-notification-toast-redesign-design.md`

## Global Constraints

- Work in the existing worktree `.claude/worktrees/notification-toast-redesign` on branch `worktree-notification-toast-redesign`. Do not touch the main checkout.
- pnpm only. Do not add dependencies.
- No `any`, no unsafe casts, no non-null assertions. Handle `null`/`undefined` deliberately.
- All user-facing text goes through Paraglide. Edit `messages/en.json` and `messages/ru.json`; never edit `src/paraglide/**`.
- `baseLocale` is `ru`. Counted strings MUST use message-format plural variants with `one` / `few` / `many` / `*`. Never branch on a count in TypeScript.
- Do not edit generated files: `src/routeTree.gen.ts`, `src/paraglide/**`, `src/api/types.ts`, `src/generated/**`.
- Type scale is remapped: `text-sm` is 12px, `text-base` is 14px. Radius is remapped: `rounded-md` is 10px, `rounded-lg` is 12px, `rounded-xl` is 28px. Never assume Tailwind defaults.
- Tailwind's `ease-out` utility is remapped to the theme's `--ease-standard` (`node_modules/@astryxdesign/core/src/tailwind-theme.css:223`). Use `ease-out`, not an arbitrary cubic-bezier.
- Tailwind 4.1.18 gates the `hover:` variant behind `@media (hover: hover)`. Do not add your own media query.
- Use token-backed utilities (`text-primary`, `text-secondary`, `bg-muted`, `ring-surface`). No raw colors, no arbitrary color values.
- Minimum validation before each commit: `pnpm typecheck`. Run `pnpm test` for tasks that touch tests.
- Run all commands from the worktree root.

---

### Task 1: Notification group store

**Files:**
- Create: `src/features/notifications/utils/notification-group-store.ts`
- Create: `src/features/notifications/utils/notification-group-store.test.ts`
- Create: `src/features/notifications/model/notification-fixtures.ts`

**Interfaces:**
- Consumes: `MessageNotificationDetails` from `../model/types` (existing).
- Produces:
  - `NOTIFICATION_GROUP_LIMIT: number` (value `5`)
  - `type NotificationGroup = { items: MessageNotificationDetails[]; total: number }`
  - `appendToNotificationGroup(details: MessageNotificationDetails): NotificationGroup`
  - `clearNotificationGroup(conversationId: string): void`
  - `resetNotificationGroups(): void`
  - `buildMessageNotificationDetails(overrides?: Partial<MessageNotificationDetails>): MessageNotificationDetails` from `../model/notification-fixtures`

The fixture module exists so Task 1's and Task 3's tests share one typed factory instead of duplicating a 40-line literal or reaching for a cast. It is imported only by tests, so it never reaches a bundle.

- [ ] **Step 1: Create the shared test fixture**

Create `src/features/notifications/model/notification-fixtures.ts`:

```ts
import type { MessageNotificationDetails } from './types'

/**
 * A complete, valid `MessageNotificationDetails` for tests.
 *
 * Lives in `model/` rather than inside one `.test.ts` so the group-store and
 * component suites share a single typed factory. Building the real shape
 * rather than casting keeps the fixtures honest when the type changes.
 */
export function buildMessageNotificationDetails(
  overrides: Partial<MessageNotificationDetails> = {},
): MessageNotificationDetails {
  // Relative to "now", so `formatRelativeShort` renders a stable, digit-free
  // label and cannot collide with assertions on the group chip's numeral.
  const now = new Date().toISOString()
  return {
    id: 'n1',
    workspaceId: 'w1',
    workspaceName: 'Acme Support',
    conversationId: 'c1',
    messageId: 'm1',
    createdAt: now,
    message: {
      id: 'm1',
      type: 'text',
      content: 'Hello, I still need help with my order',
      metadata: {},
      media_filename: null,
      media_mime_type: null,
      created_at: now,
      direction: 'inbound',
    },
    conversation: {
      id: 'c1',
      workspace_id: 'w1',
      channel_id: 'ch1',
      contact_id: 'ct1',
      assigned_to: null,
      status: 'open',
      unread_count: 0,
      last_message_at: now,
      last_message_preview: null,
      snoozed_until: null,
      external_thread_id: null,
      last_inbound_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      channel: { id: 'ch1', type: 'telegram', name: 'Support' },
      contact: {
        id: 'ct1',
        name: 'Maria',
        phone: null,
        avatar_url: null,
        status: 'active',
      },
    },
    ...overrides,
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/notifications/utils/notification-group-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { buildMessageNotificationDetails } from '../model/notification-fixtures'
import {
  NOTIFICATION_GROUP_LIMIT,
  appendToNotificationGroup,
  clearNotificationGroup,
  resetNotificationGroups,
} from './notification-group-store'

function message(id: string, conversationId = 'c1') {
  return buildMessageNotificationDetails({ id, conversationId })
}

describe('notification group store', () => {
  beforeEach(() => {
    resetNotificationGroups()
  })

  it('starts a group at one message', () => {
    const group = appendToNotificationGroup(message('n1'))
    expect(group.items.map((item) => item.id)).toEqual(['n1'])
    expect(group.total).toBe(1)
  })

  it('accumulates messages for the same conversation, newest last', () => {
    appendToNotificationGroup(message('n1'))
    appendToNotificationGroup(message('n2'))
    const group = appendToNotificationGroup(message('n3'))
    expect(group.items.map((item) => item.id)).toEqual(['n1', 'n2', 'n3'])
    expect(group.total).toBe(3)
  })

  it('keeps conversations independent', () => {
    appendToNotificationGroup(message('n1', 'c1'))
    const other = appendToNotificationGroup(message('n2', 'c2'))
    expect(other.items.map((item) => item.id)).toEqual(['n2'])
    expect(other.total).toBe(1)
  })

  it('caps retained messages but keeps counting the total', () => {
    for (let index = 0; index < NOTIFICATION_GROUP_LIMIT + 3; index += 1) {
      appendToNotificationGroup(message(`n${index}`))
    }
    const group = appendToNotificationGroup(message('last'))
    expect(group.items).toHaveLength(NOTIFICATION_GROUP_LIMIT)
    expect(group.items[group.items.length - 1]?.id).toBe('last')
    expect(group.total).toBe(NOTIFICATION_GROUP_LIMIT + 4)
  })

  it('ignores a redelivered notification id', () => {
    appendToNotificationGroup(message('n1'))
    const group = appendToNotificationGroup(message('n1'))
    expect(group.items).toHaveLength(1)
    expect(group.total).toBe(1)
  })

  it('drops a group once its toast is gone', () => {
    appendToNotificationGroup(message('n1'))
    appendToNotificationGroup(message('n2'))
    clearNotificationGroup('c1')
    const group = appendToNotificationGroup(message('n3'))
    expect(group.items.map((item) => item.id)).toEqual(['n3'])
    expect(group.total).toBe(1)
  })

  it('returns a fresh object each time so React sees a change', () => {
    const first = appendToNotificationGroup(message('n1'))
    const second = appendToNotificationGroup(message('n2'))
    expect(second).not.toBe(first)
    expect(first.items).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/features/notifications/utils/notification-group-store.test.ts`
Expected: FAIL — cannot resolve `./notification-group-store`.

- [ ] **Step 4: Write the implementation**

Create `src/features/notifications/utils/notification-group-store.ts`:

```ts
import type { MessageNotificationDetails } from '../model/types'

/** Messages retained per conversation. The chip still counts the rest. */
export const NOTIFICATION_GROUP_LIMIT = 5

export type NotificationGroup = {
  /** Oldest first, newest last. At most `NOTIFICATION_GROUP_LIMIT` entries. */
  items: MessageNotificationDetails[]
  /** Every message seen while this conversation's toast has been live. */
  total: number
}

const groups = new Map<string, NotificationGroup>()

/**
 * Add a message to its conversation's live group and return the new snapshot.
 *
 * A group lives exactly as long as the toast that renders it. Astryx's
 * `overwrite` collision behavior swaps the toast entry via `prev.map(...)`
 * without calling `removeToast`, so `onHide` never fires on regrouping — only
 * a real dismiss or auto-hide clears the group.
 */
export function appendToNotificationGroup(
  details: MessageNotificationDetails,
): NotificationGroup {
  const current = groups.get(details.conversationId)

  // Realtime can redeliver a row. `NotificationDeduper` already guards the
  // presentation path, but the store is cheap to make idempotent on its own.
  if (current?.items.some((item) => item.id === details.id)) {
    return current
  }

  const next: NotificationGroup = {
    items: [...(current?.items ?? []), details].slice(-NOTIFICATION_GROUP_LIMIT),
    total: (current?.total ?? 0) + 1,
  }
  groups.set(details.conversationId, next)
  return next
}

/** Drop a conversation's group once its toast is gone. */
export function clearNotificationGroup(conversationId: string): void {
  groups.delete(conversationId)
}

/** Test seam. The store is a module singleton, like the toast viewport. */
export function resetNotificationGroups(): void {
  groups.clear()
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/features/notifications/utils/notification-group-store.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/notifications/utils/notification-group-store.ts src/features/notifications/utils/notification-group-store.test.ts src/features/notifications/model/notification-fixtures.ts
git commit -m "feat: add a per-conversation notification group store"
```

---

### Task 2: Message catalogue

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/ru.json`
- Modify: `src/lib/message-plurals.test.ts`

**Interfaces:**
- Produces: `m.notifications_group_expand({ count })` and `m.notifications_group_collapse()`, consumed by Task 3.
- This task is **purely additive**. `notifications_open_thread` and `notifications_show_full_message` are retired in Task 3, in the same commit that deletes their last call sites — removing them here would leave the tree unable to typecheck, which the Global Constraints forbid at a commit boundary.

`notifications_group_expand` takes the number of *hidden* messages (`total - 1`), not the total. The chip's visible numeral is the total; its accessible name describes what expanding reveals.

`notifications_group_collapse` is not counted, so it stays a plain string.

- [ ] **Step 1: Add the new keys to `messages/en.json`**

Insert after the `"notifications_preview_sticker"` line. Do **not** delete anything — `notifications_open_thread` and `notifications_show_full_message` still have call sites until Task 3.

```json
  "notifications_group_expand": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "Show {count} more message",
        "countPlural=*": "Show {count} more messages"
      }
    }
  ],
  "notifications_group_collapse": "Show fewer messages",
```

- [ ] **Step 2: Add the new keys to `messages/ru.json`**

Insert at the matching position. Again, delete nothing.

```json
  "notifications_group_expand": [
    {
      "declarations": ["input count", "local countPlural = count: plural"],
      "selectors": ["countPlural"],
      "match": {
        "countPlural=one": "Показать ещё {count} сообщение",
        "countPlural=few": "Показать ещё {count} сообщения",
        "countPlural=many": "Показать ещё {count} сообщений",
        "countPlural=*": "Показать ещё {count} сообщения"
      }
    }
  ],
  "notifications_group_collapse": "Свернуть сообщения",
```

- [ ] **Step 3: Compile the catalogues**

Run: `pnpm i18n:compile`
Expected: succeeds, `src/paraglide/` regenerates. Do not hand-edit anything it writes.

- [ ] **Step 4: Add the plural assertion**

In `src/lib/message-plurals.test.ts`, inside the `describe('ru counted messages agree with their number', ...)` block, add:

```ts
  it('declines the notification group expand action', () => {
    expect(m.notifications_group_expand({ count: 1 }, ru)).toBe(
      'Показать ещё 1 сообщение',
    )
    expect(m.notifications_group_expand({ count: 2 }, ru)).toBe(
      'Показать ещё 2 сообщения',
    )
    expect(m.notifications_group_expand({ count: 5 }, ru)).toBe(
      'Показать ещё 5 сообщений',
    )
    expect(m.notifications_group_expand({ count: 21 }, ru)).toBe(
      'Показать ещё 21 сообщение',
    )
  })
```

- [ ] **Step 5: Run the plural test**

Run: `pnpm vitest run src/lib/message-plurals.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify key parity by hand**

Nothing automated checks that the two catalogues carry the same keys. Confirm both files gained exactly `notifications_group_expand` and `notifications_group_collapse`:

```bash
node --input-type=module -e "import {readFileSync} from 'node:fs';const k=f=>Object.keys(JSON.parse(readFileSync(f,'utf8')));const a=k('messages/en.json'),b=k('messages/ru.json');const d=[...a.filter(x=>!b.includes(x)),...b.filter(x=>!a.includes(x))];console.log(d.length?d:'parity ok')"
```

Expected: `parity ok`.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. Nothing was removed, so the existing call sites still resolve.

- [ ] **Step 8: Commit**

`src/paraglide/` is gitignored — the compiled output is not committed. Stage only the sources:

```bash
git add messages/en.json messages/ru.json src/lib/message-plurals.test.ts
git commit -m "i18n: add notification group expand and collapse copy"
```

---

### Task 3: Toast body rewrite and grouping wiring

Both halves of `message-notification.tsx` change together. The file cannot
compile with a new `MessageNotification` prop shape and an old
`showMessageNotificationToast` still passing `details`, so splitting these would
produce a task that knowingly fails `pnpm typecheck` — no reviewer could gate it
independently.

**Files:**
- Modify: `src/features/notifications/components/message-notification.tsx`
- Delete: `src/features/notifications/components/notification-preview.tsx`
- Modify: `src/features/notifications/components/message-notification.test.tsx`
- Modify: `messages/en.json`, `messages/ru.json` (retire two keys)

**Interfaces:**
- Consumes: `NotificationGroup`, `appendToNotificationGroup`, `clearNotificationGroup`, from Task 1. `m.notifications_group_expand` / `m.notifications_group_collapse`, from Task 2.
- Produces: `MessageNotification` now takes `{ group: NotificationGroup; previewMode: MessagePreviewMode; onOpen: () => void }` instead of `{ details, previewMode, onOpen }`.
- Unchanged: `ShowMessageNotificationOptions` keeps `{ details, previewMode, onOpen, showToast }`, so `use-message-notifications.ts` needs no edit.

`notification-preview.tsx` (the component) is deleted — its only consumer was the expander, and it is not re-exported from `src/features/notifications/index.ts`. Do not confuse it with `utils/notification-preview.ts` (the `buildNotificationPreview` helper), which stays.

Layering note, load-bearing: the overlay button is `position: absolute`, so it paints in the positioned layer *above* static content regardless of DOM order. The avatar and text column therefore carry `relative` so they are positioned too and win on DOM order, plus `pointer-events-none` so clicks fall through to the overlay. The count chip re-enables pointer events and raises itself with `z-10`.

- [ ] **Step 1: Write the failing test**

Replace the body of `src/features/notifications/components/message-notification.test.tsx` with:

```tsx
import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { buildMessageNotificationDetails } from '../model/notification-fixtures'
import type { NotificationGroup } from '../utils/notification-group-store'
import { MessageNotification } from './message-notification'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

function groupOf(
  ...items: Array<Parameters<typeof buildMessageNotificationDetails>[0]>
): NotificationGroup {
  return {
    items: items.map((overrides) => buildMessageNotificationDetails(overrides)),
    total: items.length,
  }
}

describe('MessageNotification', () => {
  beforeAll(() => {
    setLocale('en')
  })

  it('renders name, preview and relative time only', () => {
    render(
      <MessageNotification
        group={groupOf({})}
        previewMode="full"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('Maria')).toBeTruthy()
    expect(screen.getByText(/I still need help with my order/i)).toBeTruthy()
    expect(screen.queryByText('Acme Support')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open thread' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Show full message' }),
    ).toBeNull()
  })

  it('navigates when the toast body is clicked', () => {
    const onOpen = vi.fn()
    render(
      <MessageNotification
        group={groupOf({})}
        previewMode="full"
        onOpen={onOpen}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Maria/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders no expand chip for a single message', () => {
    render(
      <MessageNotification
        group={groupOf({})}
        previewMode="full"
        onOpen={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Show \d+ more message/ }),
    ).toBeNull()
  })

  it('renders every grouped message with a chip counting the total', () => {
    const group = groupOf(
      {
        id: 'n1',
        message: {
          ...buildMessageNotificationDetails().message,
          id: 'm1',
          content: 'First question',
        },
      },
      {
        id: 'n2',
        message: {
          ...buildMessageNotificationDetails().message,
          id: 'm2',
          content: 'Second question',
        },
      },
    )
    render(
      <MessageNotification group={group} previewMode="full" onOpen={vi.fn()} />,
    )
    expect(screen.getByText('First question')).toBeTruthy()
    expect(screen.getByText('Second question')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Show 1 more message' }),
    ).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('toggles the chip between expand and collapse without navigating', () => {
    const onOpen = vi.fn()
    const group = groupOf({ id: 'n1' }, { id: 'n2' })
    render(
      <MessageNotification group={group} previewMode="full" onOpen={onOpen} />,
    )
    const chip = screen.getByRole('button', { name: 'Show 1 more message' })
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(chip)
    const collapse = screen.getByRole('button', { name: 'Show fewer messages' })
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('counts messages dropped by the retention cap', () => {
    const group: NotificationGroup = {
      items: [buildMessageNotificationDetails({ id: 'n9' })],
      total: 7,
    }
    render(
      <MessageNotification group={group} previewMode="full" onOpen={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: 'Show 6 more messages' }),
    ).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
  })

  it('hides sender, content and the group in hidden preview mode', () => {
    const group = groupOf({ id: 'n1' }, { id: 'n2' })
    render(
      <MessageNotification
        group={group}
        previewMode="hidden"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.queryByText('Maria')).toBeNull()
    expect(screen.queryByText(/I still need help with my order/i)).toBeNull()
    expect(screen.getByText('New message')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Show \d+ more message/ }),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/features/notifications/components/message-notification.test.tsx`
Expected: FAIL — `MessageNotification` still expects a `details` prop.

- [ ] **Step 3: Rewrite the file**

Replace the entire contents of `src/features/notifications/components/message-notification.tsx`:

```tsx
import { listItemStyle } from '@/components/list'
import { PlatformIcon, isChannelType } from '@/entities/channel'
import { formatRelativeShort } from '@/features/inbox/utils/relative-time'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import type { ShowToastFn } from '@astryxdesign/core/Toast'
import { BellIcon } from 'lucide-react'
import { useState } from 'react'
import type {
  MessageNotificationDetails,
  MessagePreviewMode,
} from '../model/types'
import type { NotificationGroup } from '../utils/notification-group-store'
import {
  appendToNotificationGroup,
  clearNotificationGroup,
} from '../utils/notification-group-store'
import type { NotificationTarget } from '../utils/notification-navigation'
import { buildNotificationPreview } from '../utils/notification-preview'

type Props = {
  group: NotificationGroup
  previewMode: MessagePreviewMode
  onOpen: () => void
}

/** One message line: body text, plus its own time when it is not the newest. */
function NotificationLine({
  text,
  time,
  clamp,
}: {
  text: string
  time: string | null
  clamp: 'truncate' | 'line-clamp-2'
}) {
  return (
    <div className="flex items-baseline gap-2">
      <p className={cn('text-secondary min-w-0 flex-1 text-base', clamp)}>
        {text}
      </p>
      {time ? (
        <span className="text-secondary shrink-0 text-sm tabular-nums">
          {time}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Rich in-app notification body rendered inside an Astryx toast.
 *
 * The whole body navigates: an absolutely positioned overlay button covers it,
 * with the avatar and text column marked `pointer-events-none` so clicks fall
 * through. Astryx renders its close button as a flex *sibling* of the body
 * rather than an overlay, so nothing here can cover it — which is also why the
 * old `pe-6` reserve was unnecessary.
 *
 * Older messages of the same conversation sit in a `grid-template-rows` region
 * *above* the newest one, so expanding grows the toast downward and the newest
 * message never moves.
 */
export function MessageNotification({ group, previewMode, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false)

  const showContactVisuals = previewMode !== 'hidden'
  // A visible count would leak how many messages arrived, which is precisely
  // what the hidden preview mode exists to withhold.
  const items = showContactVisuals ? group.items : group.items.slice(-1)
  const total = showContactVisuals ? group.total : 1

  const newest = items[items.length - 1]
  if (!newest) return null

  const older = items.slice(0, -1)
  const hiddenCount = total - 1
  const { conversation } = newest
  const contactName = conversation.contact.name
  const channelType = isChannelType(conversation.channel.type)
    ? conversation.channel.type
    : null

  const preview = buildNotificationPreview({
    contactName,
    message: newest.message,
    previewMode,
  })
  const newestTime = formatRelativeShort(newest.createdAt)

  // Announce the action, the message and the time in one label; the row's
  // visual children stay decorative for assistive technology.
  const openLabel = [
    m.notifications_item_open_aria({ name: preview.title }),
    preview.body,
    newestTime,
  ]
    .filter(Boolean)
    .join(', ')

  const revealClass = cn(
    'transition-[grid-template-rows] duration-200 ease-out',
    'motion-reduce:transition-none',
    'grid grid-rows-[0fr] group-hover/toast:grid-rows-[1fr]',
    expanded && 'grid-rows-[1fr]',
  )
  const revealInnerClass = cn(
    'overflow-hidden opacity-0 transition-opacity duration-200 ease-out',
    'motion-reduce:transition-none',
    'group-hover/toast:opacity-100',
    expanded && 'opacity-100',
  )

  return (
    <div
      data-expanded={expanded}
      className={cn(
        'group/toast relative flex w-full items-start gap-3',
        listItemStyle.transition,
        // `:active` matches ancestors of the pressed button, so pressing the
        // overlay scales the whole row rather than an invisible rectangle.
        listItemStyle.press,
      )}
    >
      <button
        type="button"
        aria-label={openLabel}
        onClick={onOpen}
        className={cn(
          // -inset-1 bleeds the hit area 4px outward. The gap to Astryx's
          // close button is 12px, so this cannot reach it.
          'absolute -inset-1 cursor-pointer rounded-lg outline-none',
          listItemStyle.transition,
          listItemStyle.hover,
          listItemStyle.focus,
        )}
      />

      {showContactVisuals ? (
        <div className="pointer-events-none relative shrink-0">
          <Avatar
            size="md"
            name={contactName ?? undefined}
            src={conversation.contact.avatar_url ?? undefined}
          />
          {channelType ? (
            <PlatformIcon
              type={channelType}
              size="xs"
              withPlate
              className="ring-surface absolute -right-1 -bottom-1 ring-2"
            />
          ) : null}
        </div>
      ) : (
        <span className="bg-muted text-secondary pointer-events-none relative flex size-10 shrink-0 items-center justify-center rounded-xl">
          <BellIcon className="size-5" aria-hidden />
        </span>
      )}

      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-primary min-w-0 flex-1 truncate text-base font-semibold">
            {preview.title}
          </span>
          {hiddenCount > 0 ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? m.notifications_group_collapse()
                  : m.notifications_group_expand({ count: hiddenCount })
              }
              onClick={() => setExpanded((value) => !value)}
              className={cn(
                'pointer-events-auto relative z-10 shrink-0 cursor-pointer rounded-full outline-none',
                listItemStyle.focus,
              )}
            >
              <Badge variant="info" label={String(total)} />
            </button>
          ) : null}
          <span className="text-secondary shrink-0 text-sm tabular-nums">
            {newestTime}
          </span>
        </div>

        {older.length > 0 ? (
          <div className={revealClass}>
            <div className={revealInnerClass}>
              {older.map((item) => (
                <NotificationLine
                  key={item.id}
                  text={
                    buildNotificationPreview({
                      contactName,
                      message: item.message,
                      previewMode,
                    }).body
                  }
                  time={formatRelativeShort(item.createdAt)}
                  clamp="truncate"
                />
              ))}
            </div>
          </div>
        ) : null}

        {preview.body ? (
          <NotificationLine
            text={preview.body}
            // The newest message's time already sits in the header row.
            time={null}
            clamp="line-clamp-2"
          />
        ) : null}
      </div>
    </div>
  )
}

export type ShowMessageNotificationOptions = {
  details: MessageNotificationDetails
  previewMode: MessagePreviewMode
  onOpen: (target: NotificationTarget) => void
  /** Obtained from `useToast()` in the calling hook. */
  showToast: ShowToastFn
}

/**
 * Show a message notification as an Astryx toast.
 *
 * Messages for the same conversation join one toast rather than replacing it:
 * `uniqueID` + `collisionBehavior: 'overwrite'` swaps the entry in place while
 * the group store accumulates the bodies. Astryx's overwrite path replaces the
 * entry without calling `removeToast`, so `onHide` fires only on a real
 * dismiss or auto-hide — which is exactly when the group should be dropped.
 *
 * The replacement entry carries a new id, which is the React key, so the toast
 * replays its enter transition on each new message. That pulse is free
 * feedback and is deliberate.
 */
export function showMessageNotificationToast({
  details,
  previewMode,
  onOpen,
  showToast,
}: ShowMessageNotificationOptions): void {
  const group = appendToNotificationGroup(details)

  // Captured so clicking the toast can dismiss the toast it lives inside.
  const holder: { dismiss: () => void } = { dismiss: () => {} }

  const handleOpen = () => {
    onOpen({
      workspaceId: details.workspaceId,
      conversationId: details.conversationId,
    })
    holder.dismiss()
  }

  holder.dismiss = showToast({
    body: (
      <MessageNotification
        group={group}
        previewMode={previewMode}
        onOpen={handleOpen}
      />
    ),
    type: 'info',
    uniqueID: details.conversationId,
    collisionBehavior: 'overwrite',
    autoHideDuration: 8000,
    onHide: () => clearNotificationGroup(details.conversationId),
  })
}
```

- [ ] **Step 4: Delete the dead expander component**

```bash
git rm src/features/notifications/components/notification-preview.tsx
```

Confirm nothing still imports it:

```bash
grep -rn "components/notification-preview\|NotificationPreview\b" src/ --include=*.ts --include=*.tsx
```

Expected: only hits inside `utils/notification-preview.ts` and its test, which export a *type* named `NotificationPreview` and the `buildNotificationPreview` function. Those stay.

- [ ] **Step 5: Retire the two now-unused message keys**

This step lands in the same commit as the code that removed their call sites, so the tree never has a commit that cannot typecheck.

Delete the `"notifications_open_thread"` and `"notifications_show_full_message"` lines from **both** `messages/en.json` and `messages/ru.json`.

Confirm no call sites remain:

```bash
grep -rn "notifications_open_thread\|notifications_show_full_message" src/ messages/
```

Expected: no output.

Recompile and re-check parity:

```bash
pnpm i18n:compile
node --input-type=module -e "import {readFileSync} from 'node:fs';const k=f=>Object.keys(JSON.parse(readFileSync(f,'utf8')));const a=k('messages/en.json'),b=k('messages/ru.json');const d=[...a.filter(x=>!b.includes(x)),...b.filter(x=>!a.includes(x))];console.log(d.length?d:'parity ok')"
```

Expected: `parity ok`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run src/features/notifications/components/message-notification.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Run the whole notifications suite**

Run: `pnpm vitest run src/features/notifications`
Expected: PASS. `use-message-notifications.ts` is untouched, so any failure there is a real regression rather than an expected update.

- [ ] **Step 9: Commit**

`src/paraglide/` is gitignored; stage only sources. The deleted component is staged by `git rm` in Step 4.

```bash
git add src/features/notifications/components/message-notification.tsx src/features/notifications/components/message-notification.test.tsx messages/en.json messages/ru.json
git commit -m "feat: reduce the notification toast to a clickable grouped row"
```

---

### Task 4: Full validation and browser verification

**Files:** none changed unless a check fails.

- [ ] **Step 1: Run the full verification chain**

Run: `pnpm verify`
Expected: typecheck, lint, test, and build all pass. It stops at the first failure — fix and re-run.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev`
The worktree gets a stable port in 3100–3499 derived from its directory name. Note the printed URL.

- [ ] **Step 3: Sign in and open a workspace inbox**

Use the shared dev account: `ncase01@gmail.com` / `123456789`.

- [ ] **Step 4: Verify the redesigned toast in Russian at phone width**

Switch the app to Russian, set the browser to a 390px-wide viewport, and open a conversation *other* than the one you will send to (a toast is suppressed for the thread you are viewing). Trigger an inbound message.

Check:
- toast shows avatar with channel badge, name, two-line preview, relative time — and nothing else
- no "Открыть диалог" button, no workspace pill, no "Показать сообщение полностью"
- the name does not truncate at a normal length; the preview clamps at two lines
- tapping the toast body navigates to the thread and the toast disappears
- the close button still dismisses without navigating

- [ ] **Step 5: Verify grouping**

Send two more inbound messages to the same conversation within 8 seconds of the first.

Check:
- one toast, not three
- the chip reads `3`
- tapping the chip expands the older two above the newest; the newest does not move
- tapping the chip again collapses; neither tap navigates
- the toast does not auto-hide while expanded via the chip

- [ ] **Step 6: Verify hover behaviour on desktop**

At desktop width with a mouse: hovering the toast expands the group and pauses auto-hide; moving away collapses it and the timer resumes.

- [ ] **Step 7: Verify both colour modes**

Repeat step 4 in light and dark mode. The toast surface is inverted in both, so confirm the name, preview, time, chip, and the platform badge's `ring-surface` punch-out all read correctly against it.

- [ ] **Step 8: Regression — toast over a modal**

Open a dialog (for example workspace settings) and trigger a notification. The toast must still be visible above the modal — this exercises `AppLayerProvider`'s top-layer promotion, which the new body must not disturb.

- [ ] **Step 9: Verify `previewMode: 'hidden'`**

Set the message-preview preference to "Скрыто" and trigger two messages to one conversation. Expect a single bell-plate toast reading "Новое сообщение", with no name, no body, and no count chip.

- [ ] **Step 10: Commit any fixes, then open the pull request**

```bash
pnpm worktree:finish
```

It refuses on a dirty tree or a branch with no commits beyond `origin/main`, and reuses an existing PR if one is open.

---

## Notes for the implementer

**Grouping is bounded by the toast's lifetime.** A message arriving more than 8 seconds after the previous one starts a fresh toast. This is intended, and it means Task 4's grouping step must be done briskly or it will look like grouping is broken.

**Cross-conversation stacking is not being changed.** Astryx's `addToast` appends whenever `uniqueID` differs, up to `maxVisible` of 5, so separate conversations already produce separate stacked toasts. If you observe two *different* contacts collapsing into one toast, that is a bug outside this plan's scope — report it rather than working around it here.

**Toasts beyond `maxVisible` unmount rather than queue.** Astryx renders `toasts.slice(-maxVisible)`, so a sixth conversation's toast unmounts the oldest and stops its auto-hide timer; it reappears once others clear. Pre-existing Astryx behaviour, noted so it is not mistaken for a regression from grouping.

**jsdom cannot see any of the layout work.** The clamps, the overlay geometry, the paint order between the overlay and the content, and the expand animation are all invisible to the unit suite. Task 4's browser steps are the only check on them; do not skip them.

**No length budget is needed.** `src/lib/message-lengths.test.ts` guards catalogue strings inside fixed-width controls. The two new keys are accessible names, never painted, and the contact name is user data rather than a catalogue string — so neither belongs there.
