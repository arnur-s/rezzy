import { NumericUnreadChip } from '@/components/numeric-unread-chip'
import { m } from '@/paraglide/messages'
import { Tab, TabList } from '@astryxdesign/core/TabList'

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

function isPrimaryFilter(value: string): value is InboxPrimaryFilter {
  return FILTERS.some((filter) => filter.key === value)
}

type Props = {
  primaryFilter: InboxPrimaryFilter
  onPrimaryFilterChange: (filter: InboxPrimaryFilter) => void
  unreadCounts: Record<InboxPrimaryFilter, number>
}

/**
 * The three ways to narrow the conversation list.
 *
 * These were hand-built buttons with hand-written selected/hover classes,
 * carrying `role="tab"` inside a `role="tablist"`. That was the worse of the
 * two available inaccuracies: the ARIA tabs pattern promises arrow-key
 * movement and a `tabpanel`, and this had neither — three plain buttons, all
 * in the tab order, controlling a list that is not a panel.
 *
 * Astryx's `TabList` is a *navigation* strip: it renders `nav` + buttons and
 * marks the active one `aria-current="page"`. Not literally true either, since
 * this filter is component state and changes no URL — but it conveys the same
 * "this one is current" and it brings the roving tabindex and arrow keys the
 * hand-rolled version only claimed to have.
 *
 * A `SegmentedControl` would be the closer idiom for a filter, but its item
 * takes a leading icon and nothing after the label, so the unread counts would
 * have to be dropped. `Tab` has `endContent`, so they survive.
 */
export function PrimaryInboxFilters({
  primaryFilter,
  onPrimaryFilterChange,
  unreadCounts,
}: Props) {
  return (
    <div className="px-2 py-2">
      <TabList
        value={primaryFilter}
        // TabList's onChange is a plain string; the guard keeps a value that
        // is not one of the three from reaching the caller's union.
        onChange={(value) => {
          if (isPrimaryFilter(value)) onPrimaryFilterChange(value)
        }}
        aria-label={m.inbox_primary_filter_aria_label()}
        size="sm"
      >
        {FILTERS.map(({ key, label }) => {
          const count = unreadCounts[key]
          return (
            <Tab
              key={key}
              value={key}
              label={label()}
              endContent={
                count > 0 ? (
                  <NumericUnreadChip
                    count={count}
                    aria-label={m.inbox_unread_aria_label({ count })}
                  />
                ) : undefined
              }
            />
          )
        })}
      </TabList>
    </div>
  )
}
