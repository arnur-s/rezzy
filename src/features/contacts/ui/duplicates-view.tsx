import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Pagination } from '@astryxdesign/core/Pagination'
import { UsersRoundIcon } from 'lucide-react'
import { useState } from 'react'
import type { DuplicateGroup } from '../api/contact-merges'
import { DUPLICATE_GROUPS_PAGE_SIZE } from '../api/contact-merges'
import { useDuplicateContactGroups } from '../hooks/use-contact-merges'
import { mergeCandidateFromDuplicate } from '../model/merge-candidate'
import type { MergeCandidate } from '../model/merge-candidate'
import { ContactListSkeleton } from './contact-list-skeleton'
import { DuplicateGroupCard } from './duplicate-group-card'
import { MergeContactsDialog } from './merge-contacts-dialog'

type Props = {
  workspaceId: string
  page: number
  onPageChange: (page: number) => void
  /** Only the active view fetches — see `contacts-page.tsx`. */
  enabled: boolean
  /** Owner/admin only: the RPC behind the merge action refuses anyone else. */
  canMerge: boolean
}

/**
 * Contacts that share a phone number, channel or email, grouped for review.
 *
 * Visible to every workspace member — unlike the Archived view, this one is
 * not gated on `isAdmin`. Only the Merge action inside a group is, because
 * that is what the RPC itself refuses.
 */
export function DuplicatesView({
  workspaceId,
  page,
  onPageChange,
  enabled,
  canMerge,
}: Props) {
  const query = useDuplicateContactGroups({ workspaceId, page, enabled })
  const [pair, setPair] = useState<[MergeCandidate, MergeCandidate] | null>(
    null,
  )

  const groups = query.data?.items ?? []
  const totalCount = query.data?.totalCount ?? 0

  function openMerge(group: DuplicateGroup) {
    // The button that calls this is already disabled off `contact_count`, but
    // a duplicates page can go stale under a merge that happened elsewhere —
    // defend the dialog's exactly-two contract here too.
    if (group.contact_count !== 2) return
    setPair([
      mergeCandidateFromDuplicate(group.contacts[0]),
      mergeCandidateFromDuplicate(group.contacts[1]),
    ])
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {query.isPending ? (
          <ContactListSkeleton />
        ) : query.isError ? (
          <div className="px-4 py-4">
            <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-error text-xs">
                {m.contacts_duplicates_load_error()}
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
        ) : groups.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={<UsersRoundIcon className="text-secondary size-8" />}
              title={m.contacts_duplicates_empty_title()}
              description={m.contacts_duplicates_empty_description()}
            />
          </div>
        ) : (
          <ul
            aria-label={m.contacts_filter_duplicates()}
            className="flex flex-col px-2 py-2"
          >
            {groups.map((group) => (
              <DuplicateGroupCard
                key={group.group_key}
                group={group}
                workspaceId={workspaceId}
                canMerge={canMerge}
                onMerge={() => openMerge(group)}
              />
            ))}
          </ul>
        )}
      </div>

      {totalCount > DUPLICATE_GROUPS_PAGE_SIZE ? (
        <div className="border-border flex shrink-0 justify-end border-t px-4 py-2">
          <Pagination
            page={page}
            onChange={onPageChange}
            totalItems={totalCount}
            pageSize={DUPLICATE_GROUPS_PAGE_SIZE}
            variant="count"
            size="sm"
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
        onMerged={() => setPair(null)}
      />
    </>
  )
}
