import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Pagination } from '@astryxdesign/core/Pagination'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { useNavigate } from '@tanstack/react-router'
import { UsersRoundIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ContactListPage } from '../api/contacts'
import type {
  ContactListParams,
  ContactListPatch,
} from '../model/contact-list-params'
import {
  CONTACTS_PAGE_SIZE,
  hasActiveContactFilters,
} from '../model/contact-list-params'
import type { ListQueryState } from '../model/list-query-state'
import type { MergeCandidate } from '../model/merge-candidate'
import { mergeCandidateFromListItem } from '../model/merge-candidate'
import { ContactListRow } from './contact-list-row'
import { ContactListSkeleton } from './contact-list-skeleton'
import { MergeContactsDialog } from './merge-contacts-dialog'

/** A selection can only ever hold this many contacts — see `toggleSelected`. */
const MAX_SELECTED = 2

type Props = {
  workspaceId: string
  query: ListQueryState<ContactListPage>
  params: ContactListParams
  ownerNameById: Map<string, string>
  /** Owner/admin only: the RPC behind the merge action refuses anyone else. */
  canMerge: boolean
  onParamsChange: (patch: ContactListPatch) => void
  onClearFilters: () => void
  onCreate: () => void
}

/** The live directory: search, filter and sort results, with two-at-a-time merge selection. */
export function DirectoryView({
  workspaceId,
  query,
  params,
  ownerNameById,
  canMerge,
  onParamsChange,
  onClearFilters,
  onCreate,
}: Props) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Array<string>>([])
  const [pair, setPair] = useState<[MergeCandidate, MergeCandidate] | null>(
    null,
  )

  const items = query.data?.items ?? []
  const totalCount = query.data?.totalCount ?? 0
  const isFiltered = hasActiveContactFilters(params)

  // A page, filter or sort change swaps the row set out from under a pick —
  // without this the toolbar could keep reporting "2 selected" for ids that
  // are no longer on screen and whose checkboxes are nowhere to be seen.
  //
  // Depends on the primitive fields rather than on `params` itself: the route
  // builds that object as a fresh literal on every render of `RouteComponent`
  // (`contacts/index.tsx`), so an identity-based dependency would clear the
  // selection on any ancestor re-render with the same logical params — e.g.
  // opening the "Add contact" dialog, which touches unrelated state one level
  // up. Arrays are joined to a stable string for the same reason.
  useEffect(() => {
    setSelected([])
  }, [
    params.page,
    params.query,
    params.sort,
    params.includeUnowned,
    params.statuses.join(','),
    params.tags.join(','),
    params.ownerIds.join(','),
  ])

  function toggleSelected(contactId: string) {
    setSelected((current) => {
      if (current.includes(contactId)) {
        return current.filter((id) => id !== contactId)
      }
      // Capped at two: a third pick replaces the oldest rather than entering a
      // state the (exactly-two) merge dialog cannot open.
      const next = [...current, contactId]
      return next.length > MAX_SELECTED
        ? next.slice(next.length - MAX_SELECTED)
        : next
    })
  }

  function clearSelection() {
    setSelected([])
  }

  function openMergeForSelection() {
    if (selected.length !== MAX_SELECTED) return
    const [firstId, secondId] = selected
    const first = items.find((item) => item.id === firstId)
    const second = items.find((item) => item.id === secondId)
    if (!first || !second) return
    // Conversation counts are not in `ContactListItem`; `defaultSurvivorId`
    // falls through to `lastSeenAt`, which it does carry.
    setPair([
      mergeCandidateFromListItem(first, 0),
      mergeCandidateFromListItem(second, 0),
    ])
  }

  return (
    <>
      {selected.length > 0 ? (
        <>
          {/* Count and actions share one row, matching what the exactly-two
              state already renders cleanly. The hint is NOT a third item in
              this row — Russian's hint copy ("Выберите ровно два контакта,
              чтобы объединить их.") is long enough on its own that packing it
              alongside two buttons at a 375px viewport squeezed the row until
              "Снять выделение" clipped at the edge. Below two selected it
              renders as its own full-width line instead, free to wrap without
              taking space from the buttons. */}
          <Toolbar
            label={m.contacts_merge_selected({ count: selected.length })}
            size="sm"
            variant="muted"
            dividers={selected.length < MAX_SELECTED ? [] : ['bottom']}
            startContent={
              <span className="text-primary text-sm font-medium">
                {m.contacts_merge_selected({ count: selected.length })}
              </span>
            }
            endContent={
              <>
                <Button
                  label={m.contacts_duplicates_merge_action()}
                  size="sm"
                  variant="secondary"
                  isDisabled={selected.length !== MAX_SELECTED}
                  onClick={openMergeForSelection}
                />
                <Button
                  label={m.contacts_merge_selection_clear()}
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                />
              </>
            }
          />
          {selected.length < MAX_SELECTED ? (
            <p className="bg-muted text-secondary border-border border-b px-3 py-1.5 text-sm">
              {m.contacts_merge_selection_hint()}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.isPending ? (
          <ContactListSkeleton />
        ) : query.isError ? (
          <div className="px-4 py-4">
            <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-error text-sm">
                {m.contacts_load_error()}
              </span>
              <Button
                label={m.common_retry()}
                size="sm"
                variant="ghost"
                onClick={() => void query.refetch()}
                isLoading={query.isRefetching}
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
                    onClick={onClearFilters}
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
                selection={
                  canMerge
                    ? {
                        isSelected: selected.includes(contact.id),
                        onToggle: () => toggleSelected(contact.id),
                      }
                    : undefined
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

      <MergeContactsDialog
        workspaceId={workspaceId}
        contacts={pair}
        onOpenChange={(open) => {
          if (!open) setPair(null)
        }}
        onMerged={() => {
          setPair(null)
          clearSelection()
        }}
      />
    </>
  )
}
