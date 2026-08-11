import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Pagination } from '@astryxdesign/core/Pagination'
import { useToast } from '@astryxdesign/core/Toast'
import { UsersRoundIcon } from 'lucide-react'
import type { ArchivedContactPage } from '../api/contacts'
import { useRestoreContact } from '../hooks/use-contacts'
import { CONTACTS_PAGE_SIZE } from '../model/contact-list-params'
import type { ListQueryState } from '../model/list-query-state'
import { ArchivedContactRow } from './archived-contact-row'
import { ContactListSkeleton } from './contact-list-skeleton'

type Props = {
  workspaceId: string
  query: ListQueryState<ArchivedContactPage>
  page: number
  onPageChange: (page: number) => void
}

/** Owner/admin only — `ContactsPage` never mounts this for anyone else. */
export function ArchivedView({
  workspaceId,
  query,
  page,
  onPageChange,
}: Props) {
  const showToast = useToast()
  const restore = useRestoreContact(workspaceId)

  const items = query.data?.items ?? []
  const totalCount = query.data?.totalCount ?? 0

  function restoreContact(contactId: string) {
    restore.mutate(contactId, {
      onError: () =>
        showToast({ body: m.contact_restore_error(), type: 'error' }),
      onSuccess: () =>
        showToast({ body: m.contact_restored_toast(), type: 'info' }),
    })
  }

  return (
    <>
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
            <EmptyState
              icon={<UsersRoundIcon className="text-secondary size-8" />}
              title={m.contacts_archived_empty_title()}
              description={m.contacts_archived_empty_description()}
            />
          </div>
        ) : (
          <ul
            aria-label={m.contacts_filter_archived()}
            className="flex flex-col gap-0.5 px-2 py-2"
          >
            {items.map((contact) => (
              <ArchivedContactRow
                key={contact.id}
                contact={contact}
                onRestore={() => restoreContact(contact.id)}
                isRestoring={
                  restore.isPending && restore.variables === contact.id
                }
              />
            ))}
          </ul>
        )}
      </div>

      {totalCount > CONTACTS_PAGE_SIZE ? (
        <div className="border-border flex shrink-0 justify-end border-t px-4 py-2">
          <Pagination
            page={page}
            onChange={onPageChange}
            totalItems={totalCount}
            pageSize={CONTACTS_PAGE_SIZE}
            variant="count"
            size="sm"
            // Astryx defaults this to the English literal "Pagination".
            label={m.contacts_pagination_label()}
          />
        </div>
      ) : null}
    </>
  )
}
