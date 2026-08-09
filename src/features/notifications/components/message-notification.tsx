import { listItemStyle } from '@/components/list'
import { PlatformIcon, isChannelType } from '@/entities/channel'
import { formatRelativeShort } from '@/features/inbox/utils/relative-time'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import type { ShowToastFn } from '@astryxdesign/core/Toast'
import { BellIcon } from 'lucide-react'
import { useId, useState } from 'react'
import type {
  MessageNotificationDetails,
  MessagePreviewMode,
} from '../model/types'
import type { NotificationGroup } from '../utils/notification-group-store'
import {
  appendToNotificationGroup,
  clearNotificationGroup,
  getNotificationGroupPin,
  setNotificationGroupPin,
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
 * *above* the newest one, so the newest message stays the last line of the
 * column and expanding only inserts rows before it. Which way the toast grows
 * on screen depends on where the viewport is anchored — bottom-trailing from
 * `lg` up, top-center below it (see the toast rules in `src/styles.css`) — so
 * the newest line can shift; it never changes place in the reading order.
 */
export function MessageNotification({ group, previewMode, onOpen }: Props) {
  // Hover opens the reveal region; a chip press pins it open or closed until
  // the next pointer leave. This is tracked in state rather than via CSS
  // `group-hover` because a pointer user is by definition hovering the toast
  // when they reach the chip — `group-hover:` and a toggled utility class
  // both target the same property, and twMerge keeps only one, so the hover
  // variant would permanently win and the chip would have no visible effect.
  const [hovered, setHovered] = useState(false)
  // Every new message in the conversation mints a new toast entry, whose id is
  // the React key, so this subtree remounts. The pin therefore lives in the
  // group store, which survives regrouping; only `hovered` — which describes
  // the pointer right now — is allowed to reset.
  const conversationId = group.items.at(-1)?.conversationId ?? null
  const [pinned, setPinnedState] = useState<boolean | null>(() =>
    conversationId === null ? null : getNotificationGroupPin(conversationId),
  )
  const setPinned = (next: boolean | null) => {
    setPinnedState(next)
    if (conversationId !== null) setNotificationGroupPin(conversationId, next)
  }
  const open = pinned ?? hovered
  const revealId = useId()

  const showContactVisuals = previewMode !== 'hidden'
  // A visible count would leak how many messages arrived, which is precisely
  // what the hidden preview mode exists to withhold.
  const items = showContactVisuals ? group.items : group.items.slice(-1)
  const total = showContactVisuals ? group.total : 1

  // `.at(-1)` (unlike index access) types as possibly `undefined` without
  // relying on `noUncheckedIndexedAccess`, so the guard below isn't flagged
  // as unreachable.
  const newest = items.at(-1)
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

  // The overlay is a *sibling* of the avatar and text column, not their parent,
  // so its label suppresses nothing: anything named here is announced a second
  // time as ordinary text inside Astryx's `aria-atomic` live region. The label
  // therefore carries only the action; the visible content carries the rest.
  const openLabel = m.notifications_item_open_aria({ name: preview.title })

  const revealClass = cn(
    'transition-[grid-template-rows] duration-200 ease-out',
    'motion-reduce:transition-none',
    'grid grid-rows-[0fr]',
    open && 'grid-rows-[1fr]',
  )
  const revealInnerClass = cn(
    'overflow-hidden opacity-0 transition-opacity duration-200 ease-out',
    'motion-reduce:transition-none',
    open && 'opacity-100',
  )

  return (
    <div
      data-expanded={open}
      // Tailwind gates `hover:` behind `@media (hover: hover)`; these handlers
      // have to gate themselves, because `pointerenter` fires for touch too.
      // Ungated, a tap would expand under the finger, collapse on the
      // compatibility `pointerleave`, and then re-expand on the compatibility
      // `click` — leaving the chip permanently expand-only.
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return
        setHovered(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return
        setHovered(false)
        // Clears any chip-pinned override so the next hover starts fresh.
        setPinned(null)
      }}
      className={cn(
        'relative flex w-full items-start gap-3',
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
          // close button measures 8px at phone width, so this cannot reach it.
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
              aria-expanded={open}
              aria-controls={older.length > 0 ? revealId : undefined}
              aria-label={
                open
                  ? m.notifications_group_collapse()
                  : m.notifications_group_expand({ count: hiddenCount })
              }
              onClick={() => setPinned(!open)}
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
          <div id={revealId} aria-hidden={!open} className={revealClass}>
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
