import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getContactById, updateContactNotes } from '../api/contacts'
import { inboxQueryKeys } from '../api/query-keys'
import type { ContactWithChannels } from '../types'

export function useContact(contactId: string | null) {
  return useQuery({
    queryFn: () => getContactById(contactId!),
    queryKey: inboxQueryKeys.contact(contactId ?? ''),
    enabled: !!contactId,
  })
}

export function useUpdateContactNotes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      contactId,
      notes,
    }: {
      contactId: string
      notes: string
    }) => updateContactNotes({ contactId, notes }),
    onMutate: async ({ contactId, notes }) => {
      const key = inboxQueryKeys.contact(contactId)
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<ContactWithChannels>(key)

      queryClient.setQueryData<ContactWithChannels>(key, (current) =>
        current ? { ...current, notes } : current,
      )

      return { snapshot, key }
    },
    onError: (_error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(context.key, context.snapshot)
      }
    },
  })
}
