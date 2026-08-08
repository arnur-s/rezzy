import { m } from '@/paraglide/messages'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { useToast } from '@astryxdesign/core/Toast'
import {
  useArchiveContact,
  useContactConversationCount,
} from '../hooks/use-contacts'

type Props = {
  workspaceId: string
  /** Null closes the dialog; a contact id opens it for that contact. */
  contactId: string | null
  onOpenChange: (open: boolean) => void
  /** Called after a successful archive, for the caller to navigate away. */
  onArchived: () => void
}

/**
 * Confirmation for archiving a contact.
 *
 * The copy deliberately does not promise the person is gone. Archiving hides
 * rows and scrubs nothing, and `trg_unarchive_on_inbound_message` brings the
 * contact back the moment they write in again — so wording this as a deletion
 * would make that reappearance read as a bug rather than the design.
 *
 * The action is not styled destructive for the same reason: nothing is
 * destroyed, and a red button would claim otherwise.
 */
export function ArchiveContactDialog({
  workspaceId,
  contactId,
  onOpenChange,
  onArchived,
}: Props) {
  const showToast = useToast()
  const archive = useArchiveContact(workspaceId)
  // Fetched here, and only while the dialog is open, rather than on every
  // contact anyone opens. The detail page's own conversation list is capped at
  // five, so its length would understate the number for a busy contact.
  const conversationCount = useContactConversationCount(
    workspaceId,
    contactId ?? '',
    contactId !== null,
  )

  function confirmArchive() {
    if (!contactId || archive.isPending) return

    archive.mutate(contactId, {
      onError: () => {
        showToast({ body: m.contact_archive_error(), type: 'error' })
        onOpenChange(false)
      },
      onSuccess: () => {
        showToast({ body: m.contact_archived_toast(), type: 'info' })
        onOpenChange(false)
        onArchived()
      },
    })
  }

  return (
    <AlertDialog
      isOpen={contactId !== null}
      onOpenChange={onOpenChange}
      title={m.contact_archive_title()}
      // Two messages rather than one counted string that has to render "and 0
      // conversations". The branch is on "any at all", never on which plural
      // form to use — Russian's three forms are chosen by the catalogue.
      //
      // While the count is still loading the no-count sentence stands in. It is
      // true either way; it just says less. Rendering the counted form against a
      // placeholder zero would say something false for the length of a fetch.
      description={
        conversationCount.data
          ? m.contact_archive_description({ count: conversationCount.data })
          : m.contact_archive_description_none()
      }
      actionLabel={m.contact_archive_confirm()}
      onAction={confirmArchive}
      cancelLabel={m.common_cancel()}
      isActionLoading={archive.isPending}
    />
  )
}
