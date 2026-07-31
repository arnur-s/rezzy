import type { ContactNote } from '@/entities/contact-note'
import { formatDate } from '@/lib/format-date'
import { m } from '@/paraglide/messages'
import { IconButton } from '@astryxdesign/core/IconButton'
import { useToast } from '@astryxdesign/core/Toast'
import { PencilIcon, PinIcon, PinOffIcon, Trash2Icon } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ContactNotesScope } from '../api/contact-notes'
import { useSetContactNotePinned, useUpdateContactNote } from '../hooks/use-contact-notes'
import { ContactNoteForm } from './contact-note-form'

type Props = ContactNotesScope & {
  canModerate: boolean
  currentUserId: string | undefined
  note: ContactNote
  onRequestDelete: (note: ContactNote) => void
}

function authorLabel(note: ContactNote) {
  if (note.author_name?.trim()) return note.author_name.trim()
  return note.author_id
    ? m.contact_notes_unknown_author()
    : m.contact_notes_imported_author()
}

function NoteTimestamp({ note }: { note: ContactNote }) {
  const author = authorLabel(note)
  const wasUpdated = note.updated_at !== note.created_at
  const value = wasUpdated ? note.updated_at : note.created_at
  const date = formatDate(value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const visible = wasUpdated
    ? m.contact_notes_updated_meta({ author, date })
    : m.contact_notes_created_meta({ author, date })
  const accessible = wasUpdated
    ? m.contact_notes_updated_timestamp_aria({ author, date })
    : m.contact_notes_created_timestamp_aria({ author, date })

  return (
    <time className="text-secondary text-[0.6875rem]" dateTime={value} aria-label={accessible}>
      {visible}
    </time>
  )
}

export function ContactNoteItem({
  canModerate,
  contactId,
  currentUserId,
  note,
  onRequestDelete,
  workspaceId,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const itemRef = useRef<HTMLElement>(null)
  const showToast = useToast()
  const scope = { workspaceId, contactId }
  const updateNote = useUpdateContactNote(scope)
  const setPinned = useSetContactNotePinned(scope)
  const canEdit = note.author_id === currentUserId
  const canDelete = canEdit || canModerate

  async function saveEdit({ body }: { body: string }) {
    await updateNote.mutateAsync({ noteId: note.id, body })
    showToast({ body: m.contact_notes_updated(), type: 'info' })
    setIsEditing(false)
    window.requestAnimationFrame(() => itemRef.current?.focus())
  }

  function togglePin() {
    setPinned.mutate(
      { noteId: note.id, isPinned: !note.is_pinned },
      {
        onError: () =>
          showToast({ body: m.contact_notes_pin_error(), type: 'error' }),
      },
    )
  }

  return (
    <li>
      <article
        ref={itemRef}
        tabIndex={-1}
        className={`rounded-xl px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          note.is_pinned ? 'bg-accent-bg/10' : 'bg-muted/45'
        }`}
      >
        {isEditing ? (
          <ContactNoteForm
            initialBody={note.body}
            label={m.contact_notes_edit()}
            onCancel={() => setIsEditing(false)}
            onSave={saveEdit}
          />
        ) : (
          <>
            <div className="flex items-start gap-2">
              {note.is_pinned ? (
                <span
                  className="text-accent mt-0.5 shrink-0"
                  title={m.contact_notes_pinned_label()}
                >
                  <PinIcon className="size-3.5" aria-hidden />
                  <span className="sr-only">{m.contact_notes_pinned_label()}</span>
                </span>
              ) : null}
              <p className="text-primary min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-5">
                {note.body}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <NoteTimestamp note={note} />
              <div
                className="flex shrink-0 items-center"
                role="group"
                aria-label={m.contact_notes_actions_label()}
              >
                <IconButton
                  label={
                    note.is_pinned
                      ? m.contact_notes_unpin()
                      : m.contact_notes_pin()
                  }
                  tooltip={
                    note.is_pinned
                      ? m.contact_notes_unpin()
                      : m.contact_notes_pin()
                  }
                  icon={
                    note.is_pinned ? (
                      <PinOffIcon className="text-accent size-3.5" />
                    ) : (
                      <PinIcon className="size-3.5" />
                    )
                  }
                  size="sm"
                  variant="ghost"
                  isLoading={setPinned.isPending}
                  onClick={togglePin}
                />
                {canEdit ? (
                  <IconButton
                    label={m.contact_notes_edit()}
                    tooltip={m.contact_notes_edit()}
                    icon={<PencilIcon className="size-3.5" />}
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                  />
                ) : null}
                {canDelete ? (
                  <IconButton
                    label={m.contact_notes_delete()}
                    tooltip={m.contact_notes_delete()}
                    icon={<Trash2Icon className="size-3.5" />}
                    size="sm"
                    variant="ghost"
                    onClick={() => onRequestDelete(note)}
                  />
                ) : null}
              </div>
            </div>
          </>
        )}
      </article>
    </li>
  )
}
