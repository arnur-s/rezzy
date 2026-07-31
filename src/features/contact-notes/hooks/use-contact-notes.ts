import type { ContactNote } from '@/entities/contact-note'
import { sortContactNotes } from '@/entities/contact-note'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContactNote,
  deleteContactNote,
  listContactNotes,
  setContactNotePinned,
  updateContactNoteBody,
} from '../api/contact-notes'
import type { ContactNotesScope } from '../api/contact-notes'
import { contactNoteQueryKeys } from '../api/query-keys'

function replaceNote(notes: ReadonlyArray<ContactNote>, next: ContactNote) {
  return sortContactNotes([
    ...notes.filter((note) => note.id !== next.id),
    next,
  ])
}

export function useContactNotes({ workspaceId, contactId }: ContactNotesScope) {
  return useQuery({
    queryKey: contactNoteQueryKeys.list(workspaceId, contactId),
    queryFn: () => listContactNotes({ workspaceId, contactId }),
    enabled: Boolean(workspaceId && contactId),
  })
}

export function useCreateContactNote(scope: ContactNotesScope) {
  const queryClient = useQueryClient()
  const key = contactNoteQueryKeys.list(scope.workspaceId, scope.contactId)

  return useMutation({
    mutationFn: ({ body }: { body: string }) =>
      createContactNote({ ...scope, body }),
    onSuccess: (created) => {
      queryClient.setQueryData<Array<ContactNote>>(key, (current = []) =>
        replaceNote(current, created),
      )
    },
  })
}

export function useUpdateContactNote(scope: ContactNotesScope) {
  const queryClient = useQueryClient()
  const key = contactNoteQueryKeys.list(scope.workspaceId, scope.contactId)

  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      updateContactNoteBody({ ...scope, noteId, body }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Array<ContactNote>>(key, (current = []) =>
        replaceNote(current, updated),
      )
    },
  })
}

export function useSetContactNotePinned(scope: ContactNotesScope) {
  const queryClient = useQueryClient()
  const key = contactNoteQueryKeys.list(scope.workspaceId, scope.contactId)

  return useMutation({
    mutationFn: ({
      noteId,
      isPinned,
    }: {
      noteId: string
      isPinned: boolean
    }) => setContactNotePinned({ ...scope, noteId, isPinned }),
    onMutate: async ({ noteId, isPinned }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<Array<ContactNote>>(key)
      queryClient.setQueryData<Array<ContactNote>>(key, (current = []) =>
        sortContactNotes(
          current.map((note) =>
            note.id === noteId ? { ...note, is_pinned: isPinned } : note,
          ),
        ),
      )
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Array<ContactNote>>(key, (current = []) =>
        replaceNote(current, updated),
      )
    },
  })
}

export function useDeleteContactNote(scope: ContactNotesScope) {
  const queryClient = useQueryClient()
  const key = contactNoteQueryKeys.list(scope.workspaceId, scope.contactId)

  return useMutation({
    mutationFn: ({ noteId }: { noteId: string }) =>
      deleteContactNote({ ...scope, noteId }),
    onMutate: async ({ noteId }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<Array<ContactNote>>(key)
      queryClient.setQueryData<Array<ContactNote>>(key, (current = []) =>
        current.filter((note) => note.id !== noteId),
      )
      return { snapshot }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) queryClient.setQueryData(key, context.snapshot)
    },
  })
}
