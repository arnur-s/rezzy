import type { ContactSort, ContactStatus } from '@/entities/contact'
import { CONTACT_STATUSES, CONTACT_STATUS_META } from '@/entities/contact'
import {
  useIsWorkspaceAdmin,
  useWorkspaceMemberDirectory,
} from '@/features/workspaces/hooks/use-workspaces'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useMemo, useState } from 'react'
import { useArchivedContacts, useContactList } from '../hooks/use-contacts'
import type {
  ContactListParams,
  ContactListPatch,
} from '../model/contact-list-params'
import { hasActiveContactFilters } from '../model/contact-list-params'
import { ArchivedView } from './archived-view'
import { DirectoryView } from './directory-view'
import { DuplicatesView } from './duplicates-view'

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
  /** Whether the Archived filter is the active view. Lives in the URL. */
  isArchived: boolean
  /** Whether the Duplicates view is active. Lives in the URL. */
  isDuplicates: boolean
  /** Partial patch; the route merges it into the URL. */
  onParamsChange: (patch: ContactListPatch) => void
  onCreate: () => void
}

export function ContactsPage({
  workspaceId,
  params,
  isArchived,
  isDuplicates,
  onParamsChange,
  onCreate,
}: Props) {
  const [searchText, setSearchText] = useState(params.query)
  const debouncedSearch = useDebounce(searchText, 300)
  const { isAdmin, isLoaded: isRoleLoaded } = useIsWorkspaceAdmin(workspaceId)
  // Duplicates is visible to every member — only the Merge action inside it is
  // owner/admin only, matching the RPC. Archived stays owner/admin only for the
  // whole view: `list_archived_contacts` raises 42501 for a member, so the
  // admin check is a precondition of the request, not decoration on top of it.
  // The two are mutually exclusive by construction, not by an extra redirect:
  // duplicates wins over a stale/hand-edited URL carrying both.
  const isDuplicatesView = isDuplicates
  const isArchivedView = isArchived && !isDuplicatesView && isAdmin
  const isDirectoryView = !isArchivedView && !isDuplicatesView

  // The live directory is not worth fetching underneath a view that is
  // showing something else, and vice versa for the archive.
  const contactsQuery = useContactList(workspaceId, params, isDirectoryView)
  const archivedQuery = useArchivedContacts({
    workspaceId,
    query: params.query,
    page: params.page,
    enabled: isArchivedView,
  })
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)

  // A member who lands on ?archived=true — a shared link, or a demotion since
  // the link was made — is put back on the directory rather than shown an empty
  // panel they cannot explain. Waits for the roster, because "not an admin" and
  // "not known yet" are the same false before it arrives.
  useEffect(() => {
    if (isArchived && isRoleLoaded && !isAdmin) {
      onParamsChange({ archived: false, page: 1 })
    }
  }, [isArchived, isRoleLoaded, isAdmin])

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
  // Preserved exactly as before the split: the header always reflects the
  // live directory's own query, not whichever view happens to be showing —
  // switching to Archived does not repaint the count until the directory is
  // revisited or refetched.
  const totalCount = isArchivedView
    ? (archivedQuery.data?.totalCount ?? 0)
    : (contactsQuery.data?.totalCount ?? 0)

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
      <header className="border-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
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
        {/* Neither the archive nor the duplicates scan take a search term, so
            the field is hidden for duplicates. It stays for archived, which
            does take one. */}
        {isDuplicatesView ? null : (
          <TextInput
            label={m.contacts_search_label()}
            isLabelHidden
            placeholder={m.contacts_search_placeholder()}
            value={searchText}
            onChange={(next) => setSearchText(next)}
            hasClear
            size="sm"
          />
        )}

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={m.contacts_filters_label()}
        >
          {/* The archive and the duplicates scan are served by different RPCs
              that take no status/owner/sort/tag arguments, so those controls
              have nothing to act on there and are hidden rather than left
              inert. */}
          {isArchivedView || isDuplicatesView ? null : (
            <>
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
            </>
          )}

          {/* Visible to every member — reporting a duplicate does not require
              the RPC's own owner/admin gate, only merging one does. */}
          <button
            type="button"
            aria-pressed={isDuplicatesView}
            onClick={() =>
              onParamsChange({
                duplicates: !isDuplicatesView,
                archived: false,
                page: 1,
              })
            }
            className={cn(
              'focus-visible:ring-accent rounded-md px-2 py-1 text-xs transition focus-visible:ring-2 focus-visible:outline-none',
              isDuplicatesView
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-primary/60 hover:bg-primary/5 hover:text-primary',
            )}
          >
            {m.contacts_filter_duplicates()}
          </button>

          {/* Owner/admin only, because the RPC behind it is. Rendering it for a
              member would offer a view that answers 42501. */}
          {isAdmin ? (
            <button
              type="button"
              aria-pressed={isArchivedView}
              onClick={() =>
                onParamsChange({
                  archived: !isArchivedView,
                  duplicates: false,
                  page: 1,
                })
              }
              className={cn(
                'focus-visible:ring-accent rounded-md px-2 py-1 text-xs transition focus-visible:ring-2 focus-visible:outline-none',
                isArchivedView
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-primary/60 hover:bg-primary/5 hover:text-primary',
              )}
            >
              {m.contacts_filter_archived()}
            </button>
          ) : null}
        </div>

        {isArchivedView ? (
          <p className="text-secondary text-xs">
            {m.contacts_archived_notice()}
          </p>
        ) : isDuplicatesView ? (
          <p className="text-secondary text-xs">
            {m.contacts_duplicates_notice()}
          </p>
        ) : null}
      </div>

      {isArchivedView ? (
        <ArchivedView
          workspaceId={workspaceId}
          query={archivedQuery}
          page={params.page}
          onPageChange={(page) => onParamsChange({ page })}
        />
      ) : isDuplicatesView ? (
        <DuplicatesView
          workspaceId={workspaceId}
          page={params.page}
          onPageChange={(page) => onParamsChange({ page })}
          enabled={isDuplicatesView}
          canMerge={isAdmin}
        />
      ) : (
        <DirectoryView
          workspaceId={workspaceId}
          query={contactsQuery}
          params={params}
          ownerNameById={ownerNameById}
          canMerge={isAdmin}
          onParamsChange={onParamsChange}
          onClearFilters={clearFilters}
          onCreate={onCreate}
        />
      )}
    </div>
  )
}
