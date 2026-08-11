import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import type { ConversationWithRelations } from '@/entities/conversation'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Popover } from '@astryxdesign/core/Popover'
import { SideNavItem } from '@astryxdesign/core/SideNav'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { BellIcon } from 'lucide-react'
import type { RefObject } from 'react'
import { useCallback, useRef, useState } from 'react'
import { useUnreadNotifications } from '../hooks/use-unread-notifications'
import { UnreadNotificationItem } from './unread-notification-item'
import { UnreadNotificationsSkeleton } from './unread-notifications-skeleton'

/** The full-page list the rail links to below `md`. */
const NOTIFICATIONS_ROUTE = '/notifications'

type Props = {
  /** Active workspace, when the route has one. Notifications span all workspaces. */
  workspaceId: string | undefined
  /** Called after a navigation is triggered (used to close the mobile drawer). */
  onNavigate?: () => void
}

/**
 * Sidebar row for unread conversations, with the unread count in the trailing
 * slot and the conversation list in a popover beside the rail.
 *
 * Below `md` the rail is a drawer, so there is no rail to anchor a popover
 * beside — it would open inside a sheet that is closing, over a viewport too
 * narrow for the rows. The row becomes a plain link to `/notifications` there,
 * which renders the same list as a full pane.
 */
export function UnreadNotificationsNavItem({ workspaceId, onNavigate }: Props) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [isOpen, setIsOpen] = useState(false)
  // Sibling mode: the popover anchors to SideNavItem's own button rather than
  // wrapping it in a div, which would break the nav row's full-width layout.
  const triggerRef = useRef<HTMLElement>(null)
  const { items, totalUnread, isPending, isError, isRetrying, retry } =
    useUnreadNotifications(workspaceId)

  // Rows carry their own workspace, so a notification opens in the right inbox
  // even from the home page.
  const handleSelect = useCallback(
    (conversation: ConversationWithRelations) => {
      setIsOpen(false)
      void navigate({
        to: '/workspaces/$id/inbox/$conversationId',
        params: {
          id: conversation.workspace_id,
          conversationId: conversation.id,
        },
      })
    },
    [navigate],
  )

  // Only offered on a workspace route. Notifications span every workspace, so
  // off-route there is no single inbox that would show "all" of them — and the
  // home page already lists them in full.
  const handleViewAll = useCallback(() => {
    if (!workspaceId) return
    setIsOpen(false)
    void navigate({ to: '/workspaces/$id/inbox', params: { id: workspaceId } })
  }, [navigate, workspaceId])

  const content = (
    <div className="flex w-full flex-col overflow-hidden">
      <p className="text-primary px-4 pt-3 pb-1.5 text-sm font-semibold">
        {m.notifications_popover_title()}
      </p>

      {isPending ? (
        <UnreadNotificationsSkeleton />
      ) : isError ? (
        <div className="px-1.5 pb-1.5">
          <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-2.5 py-2">
            <span className="text-error text-sm">
              {m.notifications_error()}
            </span>
            <Button
              label={m.common_retry()}
              size="sm"
              variant="ghost"
              onClick={retry}
              isLoading={isRetrying}
            />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 pt-1 pb-5">
          <p className="text-sm font-medium">{m.notifications_empty_title()}</p>
          <p className="text-secondary mt-1 text-sm">
            {m.notifications_empty_description()}
          </p>
        </div>
      ) : (
        <div className="max-h-[min(60vh,22rem)] overflow-y-auto">
          <ul className="flex flex-col gap-0.5 px-1.5 pb-1.5">
            {items.map((item) => (
              <UnreadNotificationItem
                key={item.conversation.id}
                conversation={item.conversation}
                workspaceName={item.workspaceName}
                onSelect={handleSelect}
              />
            ))}
          </ul>
        </div>
      )}

      {workspaceId ? (
        <div className="border-border/60 border-t p-1.5">
          <Button
            label={m.notifications_view_all()}
            size="sm"
            variant="ghost"
            width="100%"
            onClick={handleViewAll}
          />
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <SideNavItem
        ref={triggerRef}
        label={m.header_notifications_label()}
        icon={BellIcon}
        // A real href, not an onClick: the row stays open-in-new-tab-able and
        // the app's `RouterLink` adapter turns the click into an SPA push.
        href={isMobile ? NOTIFICATIONS_ROUTE : undefined}
        isSelected={pathname === NOTIFICATIONS_ROUTE}
        onClick={isMobile ? onNavigate : undefined}
        endContent={
          <NumericUnreadChip
            count={totalUnread}
            capAt99
            aria-label={m.notifications_unread_count_aria({
              count: totalUnread,
            })}
          />
        }
      />

      {/* Not merely closed on mobile — unmounted. Popover binds its own click
          handler to the anchor, so leaving it mounted would swallow the tap
          that is supposed to follow the row's href to the full-page list. */}
      {isMobile ? null : (
        <Popover
          // Astryx types anchorRef as a non-null RefObject, but any DOM ref is
          // null until mount. Popover reads it inside a layout effect and bails
          // when it is empty, so the narrowing is safe.
          anchorRef={triggerRef as RefObject<HTMLElement>}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          placement="end"
          alignment="start"
          width="min(92vw, 22rem)"
          label={m.notifications_popover_title()}
          // Astryx pads the popover surface by 12px, which this content already
          // budgets for itself: a title on the 16px text axis, a recessed list
          // whose rows lift off a 6px gutter, and a footer rule meant to span
          // the full width. Paying it twice pushed everything inward and left
          // the rule floating short of both edges. Clip instead, so rows and
          // scrollbar meet the surface radius.
          className="overflow-hidden p-0"
          // The default close button is first in focus order, so autofocus lands
          // on it and reveals it. Escape and outside click still dismiss.
          hasCloseButton={false}
          content={isOpen ? content : null}
        />
      )}
    </>
  )
}
