import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Popover } from '@astryxdesign/core/Popover'
import { useNavigate } from '@tanstack/react-router'
import { BellIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useUnreadNotifications } from '../hooks/use-unread-notifications'
import { capUnreadCount } from '../utils/unread-notifications'
import { UnreadNotificationItem } from './unread-notification-item'
import { UnreadNotificationsSkeleton } from './unread-notifications-skeleton'

type Props = {
  /** Active workspace, when the route has one. Notifications span all workspaces. */
  workspaceId: string | undefined
}

/** Header bell with the unread badge and the unread-conversations popover. */
export function UnreadNotificationsPopover({ workspaceId }: Props) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
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
      <p className="text-primary px-4 pt-3.5 pb-2 text-sm font-semibold">
        {m.notifications_popover_title()}
      </p>

      {isPending ? (
        <UnreadNotificationsSkeleton />
      ) : isError ? (
        <div className="px-3 pb-3">
          <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
            <span className="text-error text-sm">
              {m.notifications_popover_error()}
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
        <div className="px-6 pt-4 pb-6 text-center">
          <p className="text-sm font-medium">
            {m.notifications_popover_empty_title()}
          </p>
          <p className="text-secondary mt-1 text-xs">
            {m.notifications_popover_empty_description()}
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
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="below"
      alignment="end"
      width="min(92vw, 22rem)"
      label={m.notifications_popover_title()}
      content={isOpen ? content : null}
    >
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label={
            totalUnread > 0
              ? m.notifications_bell_with_count_aria({ count: totalUnread })
              : m.header_notifications_label()
          }
          className="text-primary hover:bg-accent-bg/10 dark:hover:bg-accent-bg/15 focus-visible:ring-accent aria-expanded:bg-primary/10 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2"
        >
          <BellIcon className="size-4" />
        </button>
        {totalUnread > 0 ? (
          <span
            aria-hidden="true"
            className="bg-accent-bg text-on-accent pointer-events-none absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums"
          >
            {capUnreadCount(totalUnread)}
          </span>
        ) : null}
      </span>
    </Popover>
  )
}
