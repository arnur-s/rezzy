import { callRpc } from '@/utils/supabase-rpc'
import { z } from 'zod'
import type { ContactIdentityLookup } from '../model/contact-identity'
import { hasContactIdentity } from '../model/contact-identity'

/** Why a contact came back, strongest first. */
export const CONTACT_MATCH_REASONS = ['phone', 'channel', 'email'] as const
export type ContactMatchReason = (typeof CONTACT_MATCH_REASONS)[number]

const contactMatchSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  avatar_url: z.string().nullable(),
  status: z.string(),
  match_reason: z.enum(CONTACT_MATCH_REASONS),
})

export type ContactMatch = z.infer<typeof contactMatchSchema>

/** How many matches the caller is shown; more than a few is not a choice. */
const MATCH_LIMIT = 6

/**
 * Existing contacts in ONE workspace that a shared identity could already be.
 *
 * The comparison happens in Postgres (`public.match_workspace_contacts`), not
 * here. An earlier version pulled a bounded page of the workspace's contacts and
 * compared them in the browser; past that bound it could miss an existing
 * contact and offer to create a duplicate. Server-side it is an indexed equality
 * over `public.phone_digits(...)` that sees every candidate row.
 *
 * Ambiguous numbers — local format, no country context — are excluded upstream
 * by {@link ContactIdentityLookup}, so they cannot produce a wrong match here.
 *
 * An empty result means "no confident match", not "no such person": the caller
 * offers to create rather than asserting absence.
 */
export async function matchWorkspaceContacts({
  workspaceId,
  lookup,
}: {
  workspaceId: string
  lookup: ContactIdentityLookup
}): Promise<Array<ContactMatch>> {
  if (!workspaceId || !hasContactIdentity(lookup)) return []

  return callRpc(
    'match_workspace_contacts',
    {
      p_workspace_id: workspaceId,
      // undefined is dropped by JSON.stringify, so an unused facet arrives as
      // the SQL DEFAULT null rather than as an empty-array predicate.
      p_phone_digits: lookup.phoneDigits.length ? lookup.phoneDigits : undefined,
      p_emails: lookup.emails.length ? lookup.emails : undefined,
      p_identities: lookup.channelIdentities.length
        ? lookup.channelIdentities
        : undefined,
      p_limit: MATCH_LIMIT,
    },
    z.array(contactMatchSchema),
  )
}
