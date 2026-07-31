import type { ContactNote } from '@/entities/contact-note'
import { m } from '@/paraglide/messages'
import { AlertDialog } from '@astryxdesign/core/AlertDialog'
import { useToast } from '@astryxdesign/core/Toast'
import type { ContactNotesScope } from '../api/contact-notes'
import { useDeleteContactNote } from '../hooks/use-contact-notes'

type Props = ContactNotesScope & {
  note: ContactNote | null
  onOpenChange: (open: boolean) => void
}

export function DeleteContactNoteDialog({
  contactId,
  note,
  onOpenChange,
  workspaceId,
}: Props) {
  const showToast = useToast()
  const deleteNote = useDeleteContactNote({ workspaceId, contactId })

  function confirmDelete() {
    if (!note || deleteNote.isPending) return

    deleteNote.mutate(
      { noteId: note.id },
      {
        onError: () => {
          showToast({ body: m.contact_notes_delete_error(), type: 'error' })
          onOpenChange(false)
        },
        onSuccess: () => {
          showToast({ body: m.contact_notes_deleted(), type: 'info' })
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <AlertDialog
      isOpen={note !== null}
      onOpenChange={onOpenChange}
      title={m.contact_notes_delete_title()}
      description={m.contact_notes_delete_description()}
      actionLabel={m.contact_notes_delete_action()}
      onAction={confirmDelete}
      cancelLabel={m.common_cancel()}
      actionVariant="destructive"
      isActionLoading={deleteNote.isPending}
    />
  )
}
