import { AppPane } from '@/components/app-pane'
import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useNavigate } from '@tanstack/react-router'
import { BellIcon } from 'lucide-react'
import { useCallback } from 'react'
import { useUnreadNotifications } from '../hooks/use-unread-notifications'
import { UnreadNotificationItem } from './unread-notification-item'
import { UnreadNotificationsSkeleton } from './unread-notifications-skeleton'

/**
 * Full-page unread list — the phone's stand-in for the rail's popover.
 *
 * Below `md` the nav rail is a drawer, so a popover anchored to the bell would
 * open inside a sheet that is about to close, at a width that leaves the rows
 * nowhere to go. The bell links here instead and the list gets the whole pane.
 *
 * Cross-workspace and cache-sharing exactly like the popover: same hook, same
 * inbox query keys, so opening a thread from here clears the badge through the
 * inbox's own mark-read path rather than a second source of truth.
 */
export function NotificationsPage() {
  const navigate = useNavigate()
  const { items, totalUnread, isPending, isError, isRetrying, retry } =
    useUnreadNotifications(undefined)

  // Rows carry their own workspace, so a notification opens in the right inbox
  // even though this route has no workspace of its own.
  const handleSelect = useCallback(
    (conversation: ConversationWithRelations) => {
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

  return (
    <AppPane as="section" label={m.header_notifications_label()}>
      {/* 56px and a hairline — the shared pane-header contract. */}
      <header className="border-border flex h-14 shrink-0 items-center border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4">
          <h1 className="truncate text-base font-semibold">
            {m.header_notifications_label()}
          </h1>
          <NumericUnreadChip
            count={totalUnread}
            capAt99
            aria-label={m.notifications_unread_count_aria({
              count: totalUnread,
            })}
          />
        </div>
      </header>

      {/* The pane owns the scroll edge-to-edge; the column inside it owns the
          measure, so the scrollbar rides the pane rather than the rows. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The 6px gutter the rows lift off, same as the popover's — with the
            rows' own 10px inset it puts avatars on the header's 16px axis. */}
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col py-2">
          {isPending ? (
            <UnreadNotificationsSkeleton rows={6} />
          ) : isError ? (
            <div className="px-1.5">
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
            // Centred in the pane rather than stacked under the header: with
            // nothing in the list there is no column for it to head.
            <div className="flex flex-1 items-center justify-center px-4 py-12">
              <EmptyState
                title={m.notifications_empty_title()}
                description={m.notifications_empty_description()}
                icon={<BellIcon className="size-6" aria-hidden />}
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5 px-1.5">
              {items.map((item) => (
                <UnreadNotificationItem
                  key={item.conversation.id}
                  conversation={item.conversation}
                  workspaceName={item.workspaceName}
                  onSelect={handleSelect}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppPane>
  )
}
