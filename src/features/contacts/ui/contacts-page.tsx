import { CONTACT_STATUSES, CONTACT_STATUS_META } from '@/entities/contact'
import type { ContactSort, ContactStatus } from '@/entities/contact'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { useWorkspaceMemberDirectory } from '@/features/workspaces/hooks/use-workspaces'
import { Button } from '@astryxdesign/core/Button'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Pagination } from '@astryxdesign/core/Pagination'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useNavigate } from '@tanstack/react-router'
import { UsersRoundIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useContactList } from '../hooks/use-contacts'
import {
  CONTACTS_PAGE_SIZE,
  hasActiveContactFilters,
} from '../model/contact-list-params'
import type { ContactListParams } from '../model/contact-list-params'
import { ContactListRow } from './contact-list-row'

const SORT_LABELS: Record<ContactSort, () => string> = {
  recent_interaction: () => m.contacts_sort_recent_interaction(),
  recently_added: () => m.contacts_sort_recently_added(),
  recently_updated: () => m.contacts_sort_recently_updated(),
  name_asc: () => m.contacts_sort_name_asc(),
  name_desc: () => m.contacts_sort_name_desc(),
}

type Props = {
  workspaceId: string
  params: ContactListParams
  /** Partial patch; the route merges it into the URL. */
  onParamsChange: (patch: Partial<ContactListParams>) => void
  onCreate: () => void
}

function ContactListSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton width={32} height={32} radius={3} />
          <div className="flex-1">
            <Skeleton width="40%" height={14} radius={3} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ContactsPage({
  workspaceId,
  params,
  onParamsChange,
  onCreate,
}: Props) {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState(params.query)
  const debouncedSearch = useDebounce(searchText, 300)
  const contactsQuery = useContactList(workspaceId, params)
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)

  // The URL is the source of truth; this only pushes the settled search term
  // into it. Changing the term resets to page 1 — page 4 of the old result set
  // is meaningless against a new one.
  useEffect(() => {
    if (debouncedSearch !== params.query) {
      onParamsChange({ query: debouncedSearch, page: 1 })
    }
  }, [debouncedSearch])

  // A back navigation can change the URL under us; keep the field in step.
  useEffect(() => {
    setSearchText((current) =>
      current === params.query ? current : params.query,
    )
  }, [params.query])

  const ownerNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of membersQuery.data ?? []) {
      if (member.fullName) map.set(member.userId, member.fullName)
    }
    return map
  }, [membersQuery.data])

  const isFiltered = hasActiveContactFilters(params)
  const items = contactsQuery.data?.items ?? []
  const totalCount = contactsQuery.data?.totalCount ?? 0

  function toggleStatus(status: ContactStatus) {
    const next = params.statuses.includes(status)
      ? params.statuses.filter((value) => value !== status)
      : [...params.statuses, status]
    onParamsChange({ statuses: next, page: 1 })
  }

  function clearFilters() {
    setSearchText('')
    onParamsChange({
      query: '',
      statuses: [],
      tags: [],
      ownerIds: [],
      includeUnowned: false,
      page: 1,
    })
  }

  const sortItems: Array<DropdownMenuOption> = (
    Object.keys(SORT_LABELS) as Array<ContactSort>
  ).map((sort) => ({
    label: SORT_LABELS[sort](),
    onClick: () => onParamsChange({ sort, page: 1 }),
  }))

  const ownerItems: Array<DropdownMenuOption> = [
    {
      label: m.contacts_filter_unassigned(),
      onClick: () =>
        onParamsChange({
          includeUnowned: !params.includeUnowned,
          ownerIds: [],
          page: 1,
        }),
    },
    ...(membersQuery.data ?? []).map((member) => ({
      label: member.fullName,
      onClick: () =>
        onParamsChange({
          ownerIds: params.ownerIds.includes(member.userId)
            ? params.ownerIds.filter((id) => id !== member.userId)
            : [...params.ownerIds, member.userId],
          includeUnowned: false,
          page: 1,
        }),
    })),
  ]

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <header className="border-border flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-base font-semibold">{m.contacts_title()}</h1>
          {contactsQuery.isSuccess ? (
            <span className="text-secondary shrink-0 text-xs tabular-nums">
              {m.contacts_count({ count: totalCount })}
            </span>
          ) : null}
        </div>
        <Button label={m.contacts_add()} size="sm" onClick={onCreate} />
      </header>

      <div className="border-border flex shrink-0 flex-col gap-2 border-b px-4 py-3">
        <TextInput
          label={m.contacts_search_label()}
          isLabelHidden
          placeholder={m.contacts_search_placeholder()}
          value={searchText}
          onChange={(next) => setSearchText(next)}
          hasClear
          size="sm"
        />

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={m.contacts_filters_label()}
        >
          {CONTACT_STATUSES.map((status) => {
            const isActive = params.statuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleStatus(status)}
                className={cn(
                  'focus-visible:ring-accent rounded-md px-2 py-1 text-xs transition focus-visible:ring-2 focus-visible:outline-none',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-primary/60 hover:bg-primary/5 hover:text-primary',
                )}
              >
                {CONTACT_STATUS_META[status].labelKey()}
              </button>
            )
          })}

          <DropdownMenu
            menuWidth={220}
            button={{
              label: m.contacts_filter_owner(),
              variant: 'ghost',
              size: 'sm',
            }}
            items={ownerItems}
          />

          <DropdownMenu
            menuWidth={200}
            button={{
              label: `${m.contacts_sort_label()}: ${SORT_LABELS[params.sort]()}`,
              variant: 'ghost',
              size: 'sm',
            }}
            items={sortItems}
          />

          {isFiltered ? (
            <Button
              label={m.contacts_clear_filters()}
              size="sm"
              variant="ghost"
              onClick={clearFilters}
            />
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {contactsQuery.isPending ? (
          <ContactListSkeleton />
        ) : contactsQuery.isError ? (
          <div className="px-4 py-4">
            <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-error text-xs">
                {m.contacts_load_error()}
              </span>
              <Button
                label={m.common_retry()}
                size="sm"
                variant="ghost"
                onClick={() => void contactsQuery.refetch()}
                isLoading={contactsQuery.isRefetching}
              />
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            {isFiltered ? (
              <EmptyState
                icon={<UsersRoundIcon className="text-secondary size-8" />}
                title={m.contacts_no_results_title()}
                description={m.contacts_no_results_description()}
                actions={
                  <Button
                    label={m.contacts_clear_filters()}
                    variant="secondary"
                    onClick={clearFilters}
                  />
                }
              />
            ) : (
              <EmptyState
                icon={<UsersRoundIcon className="text-secondary size-8" />}
                title={m.contacts_empty_title()}
                description={m.contacts_empty_description()}
                actions={
                  <Button
                    label={m.contacts_add()}
                    variant="secondary"
                    onClick={onCreate}
                  />
                }
              />
            )}
          </div>
        ) : (
          <ul
            aria-label={m.contacts_list_label()}
            className="flex flex-col gap-0.5 px-2 py-2"
          >
            {items.map((contact) => (
              <ContactListRow
                key={contact.id}
                contact={contact}
                workspaceId={workspaceId}
                ownerName={
                  contact.owner_id
                    ? (ownerNameById.get(contact.owner_id) ?? null)
                    : null
                }
                menuItems={[
                  {
                    label: m.contacts_open(),
                    onClick: () =>
                      void navigate({
                        to: '/workspaces/$id/contacts/$contactId',
                        params: { id: workspaceId, contactId: contact.id },
                      }),
                  },
                ]}
              />
            ))}
          </ul>
        )}
      </div>

      {totalCount > CONTACTS_PAGE_SIZE ? (
        <div className="border-border flex shrink-0 justify-end border-t px-4 py-2">
          <Pagination
            page={params.page}
            onChange={(page) => onParamsChange({ page })}
            totalItems={totalCount}
            pageSize={CONTACTS_PAGE_SIZE}
            variant="count"
            size="sm"
            // Astryx defaults this to the English literal "Pagination".
            label={m.contacts_pagination_label()}
          />
        </div>
      ) : null}
    </div>
  )
}
