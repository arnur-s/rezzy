import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { m } from '@/paraglide/messages'
import { cn } from '@/lib/cn'

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
  const navLabel = m.inbox_primary_filter_aria_label()

  return (
    <div className="px-2 py-2">
      <div
        role="tablist"
        aria-label={navLabel}
        className="flex flex-row flex-wrap gap-0.5"
      >
        {FILTERS.map(({ key, label }) => {
          const isActive = primaryFilter === key
          const count = unreadCounts[key]
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onPrimaryFilterChange(key)}
              className={cn(
                'flex w-fit cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors',
                'focus-visible:ring-accent focus-visible:ring-2',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-primary/60 hover:bg-primary/5 hover:text-primary',
              )}
            >
              <span className="truncate text-left">{label()}</span>
              {count > 0 ? (
                <NumericUnreadChip
                  count={count}
                  aria-label={m.inbox_unread_aria_label({ count })}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
