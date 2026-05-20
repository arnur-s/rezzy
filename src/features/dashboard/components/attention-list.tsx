import { PlatformIcon } from '@/entities/channel'
import type { Workspace } from '@/entities/workspace'
import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import { formatRelativeTime } from '@/features/dashboard/utils/format-relative-time'
import { m } from '@/paraglide/messages'
import { List } from '@/components/list'
import { cn } from '@heroui/styles'
import { Link } from '@tanstack/react-router'
import { CheckIcon } from 'lucide-react'
import { useMemo } from 'react'

type Props = {
  items: Array<AttentionItem>
  workspaces: Array<Workspace>
  isLoading: boolean
}

export function AttentionList({ items, workspaces, isLoading }: Props) {
  const workspaceNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workspaces) map.set(w.id, w.name)
    return map
  }, [workspaces])

  return (
    <section aria-labelledby="home-attention-title" className="space-y-3">
      <h2
        id="home-attention-title"
        className="text-foreground text-sm font-semibold"
      >
        {m.home_attention_title()}
      </h2>

      {isLoading ? (
        <Skeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <List size="md">
          {items.map((item) => (
            <AttentionRow
              key={item.conversationId}
              item={item}
              workspaceName={workspaceNameById.get(item.workspaceId)}
            />
          ))}
        </List>
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
        to="/workspaces/$id/inbox"
        params={{ id: item.workspaceId }}
        aria-label={m.home_attention_row_aria({
          contact: item.contactName,
          reason: reasonLabel,
        })}
        className="active:scale-[0.99]"
      >
        {item.channelType ? (
          <PlatformIcon type={item.channelType} size="md" withPlate />
        ) : (
          <span className="bg-muted size-9 shrink-0 rounded-xl" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">
            {item.contactName}
          </p>
          <p className="text-foreground/55 mt-0.5 flex items-center gap-1.5 truncate text-xs">
            {workspaceName ? (
              <>
                <span className="truncate">{workspaceName}</span>
                <span aria-hidden="true" className="text-foreground/30">
                  ·
                </span>
              </>
            ) : null}
            <span className="tabular-nums">{timestampLabel}</span>
          </p>
        </div>

        <ReasonChip reason={item.reason} label={reasonLabel} />
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
    snoozed:
      'bg-warning/10 text-warning-foreground border-warning/20 dark:text-warning',
    unread: 'bg-primary/10 text-primary border-primary/20',
    stale: 'bg-foreground/[0.05] text-foreground/70 border-foreground/10',
  }
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4',
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
        <p className="text-foreground text-sm font-semibold">
          {m.home_attention_empty_title()}
        </p>
        <p className="text-foreground/55 text-xs">
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
        <li key={i} className="bg-foreground/5 h-12 animate-pulse rounded-lg" />
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

function getSnoozeLabel(iso: string): string {
  const wakingAgo = Date.now() - Date.parse(iso)
  if (wakingAgo < 60_000) return m.home_attention_waking_now()
  return formatRelativeTime(iso)
}
