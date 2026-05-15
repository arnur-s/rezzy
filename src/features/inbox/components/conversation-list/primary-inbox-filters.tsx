import { m } from '@/paraglide/messages'
import { cn } from '@heroui/styles'

export type InboxPrimaryFilter = 'all' | 'mine' | 'unassigned'

type FilterDef = {
  key: InboxPrimaryFilter
  label: () => string
}

const FILTERS: Array<FilterDef> = [
  { key: 'all', label: () => m.inbox_filter_all() },
  { key: 'mine', label: () => m.inbox_filter_mine() },
  { key: 'unassigned', label: () => m.inbox_filter_unassigned() },
]

type Props = {
  primaryFilter: InboxPrimaryFilter
  onPrimaryFilterChange: (filter: InboxPrimaryFilter) => void
  unreadCounts: Record<InboxPrimaryFilter, number>
}

export function PrimaryInboxFilters({
  primaryFilter,
  onPrimaryFilterChange,
  unreadCounts,
}: Props) {
  return (
    <nav aria-label={m.inbox_primary_filter_aria_label()}>
      <ul className="flex flex-col gap-0.5 px-2 py-2">
        {FILTERS.map(({ key, label }) => {
          const isActive = primaryFilter === key
          const count = unreadCounts[key]
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onPrimaryFilterChange(key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground',
                )}
              >
                <span className="flex-1 truncate text-left">{label()}</span>
                {count > 0 && (
                  <span
                    aria-label={m.inbox_unread_aria_label({ count })}
                    className={cn(
                      'inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4',
                      isActive
                        ? 'text-foreground'
                        : 'bg-accent text-accent-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
