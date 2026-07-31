import type { Workspace } from '@/entities/workspace'
import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import { DashboardConversationRow } from '@/features/dashboard/components/dashboard-conversation-row'
import { DashboardSkeletonRows } from '@/features/dashboard/components/dashboard-skeleton'
import { SectionError } from '@/features/dashboard/components/section-error'
import { SectionHeading } from '@/features/dashboard/components/section-heading'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { m } from '@/paraglide/messages'
import { List } from '@/components/list'
import { cn } from '@/lib/cn'
import { Link } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import { useMemo } from 'react'

type Props = {
  items: Array<AttentionItem>
  /** Qualifying items before the cap, so the list can be honest about what it hides. */
  total: number
  workspaces: Array<Workspace>
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  isRetrying?: boolean
  /** Where the page's primary action goes, so the overflow line can offer the same door. */
  inboxWorkspaceId: string | null
  /**
   * True when the summary line above has already reported the all-clear.
   *
   * The two read the same data, so at zero they said the same thing twice
   * within 100px — under the greeting, then again as this section's heading
   * plus its own empty state. When the summary is speaking, this section stays
   * quiet; when the summary failed to load, it speaks for itself.
   */
  isSummaryAllClear?: boolean
}

export function AttentionList({
  items,
  total,
  workspaces,
  isLoading,
  isError,
  onRetry,
  isRetrying = false,
  inboxWorkspaceId,
  isSummaryAllClear = false,
}: Props) {
  const workspaceNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workspaces) map.set(w.id, w.name)
    return map
  }, [workspaces])

  // A user with one workspace does not need every row to repeat its name.
  const showWorkspaceName = workspaces.length > 1

  const isEmpty = !isLoading && !isError && items.length === 0
  if (isEmpty && isSummaryAllClear) return null

  return (
    <section aria-labelledby="home-attention-title" className="space-y-3">
      {/* The one section the page exists to serve, so it is the one heading
          that carries full weight. */}
      <SectionHeading
        id="home-attention-title"
        title={m.home_attention_title()}
        rank="primary"
      />

      {isLoading ? (
        <DashboardSkeletonRows count={3} />
      ) : isError ? (
        <SectionError
          message={m.home_attention_error()}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <List size="md">
            {items.map((item) => (
              <DashboardConversationRow
                key={item.conversationId}
                conversationId={item.conversationId}
                workspaceId={item.workspaceId}
                contactName={item.contactName}
                channelType={item.channelType}
                preview={item.preview}
                timestampLabel={
                  item.reason === 'snoozed'
                    ? getSnoozeLabel(item.timestamp)
                    : formatRelativeTime(item.timestamp)
                }
                workspaceName={
                  showWorkspaceName
                    ? workspaceNameById.get(item.workspaceId)
                    : undefined
                }
                chip={
                  <ReasonChip
                    reason={item.reason}
                    label={getReasonLabel(item.reason)}
                  />
                }
              />
            ))}
          </List>
          {total > items.length ? (
            <p className="text-secondary text-xs">
              {m.home_attention_showing_top({ count: items.length, total })}
              {inboxWorkspaceId ? (
                <>
                  {' · '}
                  <Link
                    to="/workspaces/$id/inbox"
                    params={{ id: inboxWorkspaceId }}
                    className="text-primary font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  >
                    {m.home_open_inbox()}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function ReasonChip({
  reason,
  label,
}: {
  reason: AttentionItem['reason']
  label: string
}) {
  const classes: Record<AttentionItem['reason'], string> = {
    // The warning token is deep on parchment and pale on ink, so it reads
    // against its own 10% tint in both modes — no per-mode override needed.
    snoozed: 'bg-warning/10 text-warning border-warning/20',
    unread: 'bg-accent-bg/10 text-accent border-accent/20',
    stale: 'bg-primary/[0.05] text-secondary border-primary/10',
  }
  return (
    // No `aria-label` and no `title`. An accessible name on a non-interactive
    // span is announced inconsistently, and a tooltip never appears on touch,
    // so a definition parked in either one is documentation that most users
    // cannot reach. Each reason's threshold lives in its visible label
    // instead — "Без ответа 2+ дн." says what it means to everyone at once.
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold leading-4',
        classes[reason],
      )}
    >
      {label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        aria-hidden="true"
        className="bg-success/12 text-success flex size-8 shrink-0 items-center justify-center rounded-full"
      >
        <CheckIcon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-primary text-sm font-semibold">
          {m.home_attention_empty_title()}
        </p>
        <p className="text-secondary text-xs">
          {m.home_attention_empty_description()}
        </p>
      </div>
    </div>
  )
}

function getReasonLabel(reason: AttentionItem['reason']): string {
  switch (reason) {
    case 'snoozed':
      return m.home_attention_reason_snoozed()
    case 'unread':
      return m.home_attention_reason_unread()
    case 'stale':
      return m.home_attention_reason_stale()
  }
}


function getSnoozeLabel(iso: string): string {
  const wakingAgo = Date.now() - Date.parse(iso)
  if (wakingAgo < 60_000) return m.home_attention_waking_now()
  return formatRelativeTime(iso)
}
