import type { ContactNote } from '@/entities/contact-note'
import { useMyMemberships } from '@/features/account'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@astryxdesign/core/Button'
import { useToast } from '@astryxdesign/core/Toast'
import { useRef, useState } from 'react'
import {
  useContactNotes,
  useCreateContactNote,
} from '../hooks/use-contact-notes'
import { ContactNoteForm } from './contact-note-form'
import { ContactNoteItem } from './contact-note-item'
import { DeleteContactNoteDialog } from './delete-contact-note-dialog'

type Props = {
  workspaceId: string
  contactId: string
}

export function ContactNotesSection({ workspaceId, contactId }: Props) {
  const { user } = useAuth()
  const memberships = useMyMemberships()
  const showToast = useToast()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const [noteToDelete, setNoteToDelete] = useState<ContactNote | null>(null)
  const scope = { workspaceId, contactId }
  const notesQuery = useContactNotes(scope)
  const createNote = useCreateContactNote(scope)
  const role = memberships.data?.find(
    (membership) => membership.workspaceId === workspaceId,
  )?.role
  const canModerate = role === 'owner' || role === 'admin'

  async function saveNote({ body }: { body: string }) {
    await createNote.mutateAsync({ body })
    showToast({ body: m.contact_notes_added(), type: 'info' })
    window.requestAnimationFrame(() => composerRef.current?.focus())
  }

  return (
    <section
      aria-labelledby="contact-notes-title"
      className="flex flex-col gap-3"
    >
      <ContactNoteForm
        label={m.contact_notes_composer_label()}
        onSave={saveNote}
        resetOnSuccess
        textareaRef={composerRef}
      />

      {notesQuery.isError ? (
        <div className="bg-error/10 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
          <p className="text-error text-xs">{m.contact_notes_load_error()}</p>
          <Button
            label={m.contact_notes_retry()}
            size="sm"
            variant="ghost"
            onClick={() => void notesQuery.refetch()}
            isLoading={notesQuery.isRefetching}
          />
        </div>
      ) : null}

      {notesQuery.isSuccess && notesQuery.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {notesQuery.data.map((note) => (
            <ContactNoteItem
              key={note.id}
              workspaceId={workspaceId}
              contactId={contactId}
              note={note}
              currentUserId={user?.id}
              canModerate={canModerate}
              onRequestDelete={setNoteToDelete}
            />
          ))}
        </ul>
      ) : null}

      {/* A contact with no notes said so, rather than showing a composer above
          nothing at all — which reads as a section that failed to load, and is
          indistinguishable from one that did. */}
      {notesQuery.isSuccess && notesQuery.data.length === 0 ? (
        <p className="text-primary/60 px-1 text-xs">
          {m.contact_notes_empty_title()}
        </p>
      ) : null}

      <DeleteContactNoteDialog
        workspaceId={workspaceId}
        contactId={contactId}
        note={noteToDelete}
        onOpenChange={(open) => {
          if (!open) setNoteToDelete(null)
        }}
      />
    </section>
  )
}
