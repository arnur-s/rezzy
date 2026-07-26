import { PlatformIcon } from '@/entities/channel'
import type { Workspace } from '@/entities/workspace'
import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import { SectionError } from '@/features/dashboard/components/section-error'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { m } from '@/paraglide/messages'
import { List } from '@/components/list'
import { cn } from '@/lib/cn'
import { Link } from '@tanstack/react-router'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'
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
  /** Present when the user has exactly one workspace. */
  inboxWorkspaceId: string | null
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
}: Props) {
  const workspaceNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workspaces) map.set(w.id, w.name)
    return map
  }, [workspaces])

  return (
    <section aria-labelledby="home-attention-title" className="space-y-3">
      <h2
        id="home-attention-title"
        className="text-primary text-sm font-semibold"
      >
        {m.home_attention_title()}
      </h2>

      {isLoading ? (
        <Skeleton />
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
              <AttentionRow
                key={item.conversationId}
                item={item}
                workspaceName={workspaceNameById.get(item.workspaceId)}
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

function AttentionRow({
  item,
  workspaceName,
}: {
  item: AttentionItem
  workspaceName: string | undefined
}) {
  const reasonLabel = getReasonLabel(item.reason)
  const timestampLabel =
    item.reason === 'snoozed'
      ? getSnoozeLabel(item.timestamp)
      : formatRelativeTime(item.timestamp)

  return (
    <List.Item className="-mx-2">
      <Link
        to="/workspaces/$id/inbox/$conversationId"
        params={{
          id: item.workspaceId,
          conversationId: item.conversationId,
        }}
      >
        {item.channelType ? (
          <PlatformIcon type={item.channelType} size="md" withPlate />
        ) : (
          <span className="bg-muted size-9 shrink-0 rounded-xl" />
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm">
            <span className="text-primary truncate font-semibold">
              {item.contactName}
            </span>
            <ReasonChip reason={item.reason} label={reasonLabel} />
          </p>
          <p className="text-secondary mt-0.5 flex items-center gap-1.5 truncate text-xs">
            {workspaceName ? (
              <>
                <span className="truncate">{workspaceName}</span>
                <span aria-hidden="true" className="text-primary/30">
                  ·
                </span>
              </>
            ) : null}
            <span className="tabular-nums">{timestampLabel}</span>
          </p>
        </div>

        <ChevronRightIcon
          aria-hidden="true"
          className="text-secondary/70 size-4 shrink-0"
        />
      </Link>
    </List.Item>
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
    <span
      title={getReasonHint(reason)}
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
        className="bg-success-soft text-success flex size-8 shrink-0 items-center justify-center rounded-full"
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

function Skeleton() {
  return (
    <ul className="space-y-2" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="bg-primary/5 h-12 animate-pulse rounded-lg" />
      ))}
    </ul>
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

function getReasonHint(reason: AttentionItem['reason']): string {
  switch (reason) {
    case 'snoozed':
      return m.home_attention_reason_snoozed_hint()
    case 'unread':
      return m.home_attention_reason_unread_hint()
    case 'stale':
      return m.home_attention_reason_stale_hint()
  }
}

function getSnoozeLabel(iso: string): string {
  const wakingAgo = Date.now() - Date.parse(iso)
  if (wakingAgo < 60_000) return m.home_attention_waking_now()
  return formatRelativeTime(iso)
}
