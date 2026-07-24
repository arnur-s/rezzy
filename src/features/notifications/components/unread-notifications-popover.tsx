import { Button } from '@/components/button'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Alert, Badge, Popover, ScrollShadow, Typography } from '@heroui/react'
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

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Badge.Anchor>
        {/* The trigger is itself the pressable element (ThemeSwitcher pattern);
            nesting a Button inside would create two focusable button roles. */}
        <Popover.Trigger
          aria-label={
            totalUnread > 0
              ? m.notifications_bell_with_count_aria({ count: totalUnread })
              : m.header_notifications_label()
          }
          className="text-foreground hover:bg-accent/10 dark:hover:bg-accent/15 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus aria-expanded:bg-foreground/10"
        >
          <BellIcon className="size-4" />
        </Popover.Trigger>
        {totalUnread > 0 ? (
          // The trigger label already announces the count; keep the visual
          // badge out of the accessibility tree to avoid a double read.
          <Badge
            size="sm"
            color="accent"
            aria-hidden="true"
            className="pointer-events-none tabular-nums"
          >
            {capUnreadCount(totalUnread)}
          </Badge>
        ) : null}
      </Badge.Anchor>

      <Popover.Content placement="bottom end" className="w-[min(92vw,22rem)]">
        <Popover.Dialog className="flex w-full flex-col overflow-hidden rounded-[inherit] p-0">
          <Popover.Heading className="px-4 pt-3.5 pb-2 text-sm font-semibold text-foreground">
            {m.notifications_popover_title()}
          </Popover.Heading>

          {isPending ? (
            <UnreadNotificationsSkeleton />
          ) : isError ? (
            <div className="px-3 pb-3">
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{m.notifications_popover_error()}</Alert.Title>
                </Alert.Content>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={retry}
                  isLoading={isRetrying}
                >
                  {m.common_retry()}
                </Button>
              </Alert>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 pt-4 pb-6 text-center">
              <Typography.Paragraph className="text-sm font-medium">
                {m.notifications_popover_empty_title()}
              </Typography.Paragraph>
              <Typography.Paragraph className="mt-1 text-xs text-muted">
                {m.notifications_popover_empty_description()}
              </Typography.Paragraph>
            </div>
          ) : (
            <ScrollShadow className="max-h-[min(60vh,22rem)]">
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
            </ScrollShadow>
          )}

          {workspaceId ? (
            <div className="border-t border-border/60 p-1.5">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onPress={handleViewAll}
              >
                {m.notifications_view_all()}
              </Button>
            </div>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
