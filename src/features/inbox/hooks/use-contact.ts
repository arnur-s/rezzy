import { useQuery } from '@tanstack/react-query'
import { getContactById } from '../api/contacts'
import { inboxQueryKeys } from '../api/query-keys'

export function useContact(contactId: string | null) {
  return useQuery({
    queryFn: () => getContactById(contactId!),
    queryKey: inboxQueryKeys.contact(contactId ?? ''),
    enabled: !!contactId,
  })
}
