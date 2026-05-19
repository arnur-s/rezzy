import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { m } from '@/paraglide/messages'
import type { Selection } from '@heroui/react'
import { ListBox } from '@heroui/react'
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

function selectionToFilter(keys: Selection): InboxPrimaryFilter | undefined {
  for (const id of keys) {
    const s = String(id)
    if (s === 'all' || s === 'mine' || s === 'unassigned') return s
  }
  return undefined
}

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
      <ListBox
        className="p-0 flex flex-row flex-wrap gap-0.5 outline-none"
        orientation="horizontal"
        aria-label={navLabel}
        selectionMode="single"
        selectedKeys={new Set<InboxPrimaryFilter>([primaryFilter])}
        onSelectionChange={(keys) => {
          const next = selectionToFilter(keys)
          if (next) onPrimaryFilterChange(next)
        }}
      >
        {FILTERS.map(({ key, label }) => {
          const isActive = primaryFilter === key
          const count = unreadCounts[key]
          return (
            <ListBox.Item
              key={key}
              id={key}
              textValue={label()}
              className={cn(
                'w-fit cursor-pointer flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors',
                'text-foreground/60 data-[selected=true]:bg-foreground/10 data-[selected=true]:text-foreground',
                'data-[selected=false]:hover:bg-foreground/5 data-[selected=false]:hover:text-foreground',
                'data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-ring',
              )}
            >
              <span className="truncate text-left">{label()}</span>
              {count > 0 ? (
                <NumericUnreadChip
                  count={count}
                  flat={isActive}
                  aria-label={m.inbox_unread_aria_label({ count })}
                />
              ) : null}
            </ListBox.Item>
          )
        })}
      </ListBox>
    </div>
  )
}
