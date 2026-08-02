import { useQuery } from '@tanstack/react-query'
import { matchWorkspaceContacts } from '../api/contact-matches'
import { contactQueryKeys } from '../api/query-keys'
import type { ContactIdentityLookup } from '../model/contact-identity'
import {
  contactIdentityKey,
  hasContactIdentity,
} from '../model/contact-identity'

/**
 * Existing contacts in the active workspace that an identity could already be.
 *
 * Read-only by construction: nothing here writes a contact. Receiving a shared
 * contact must never create one.
 */
export function useContactMatches(
  workspaceId: string,
  lookup: ContactIdentityLookup,
) {
  const identityKey = contactIdentityKey(lookup)
  const isEnabled = Boolean(workspaceId) && hasContactIdentity(lookup)

  return useQuery({
    queryKey: contactQueryKeys.match(workspaceId, identityKey),
    queryFn: () => matchWorkspaceContacts({ workspaceId, lookup }),
    enabled: isEnabled,
    // The answer changes only when the workspace's contacts change, and those
    // changes arrive as invalidations from the contact mutations. A transcript
    // can hold many of these cards, so they should not each re-query on every
    // remount while the user scrolls a thread.
    staleTime: 60_000,
  })
}
