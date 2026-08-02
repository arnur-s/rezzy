import type { SharedContact } from '@/entities/message'
import { phoneIdentity, regionFromExplicitNumber } from '@/lib/phone-identity'
import type { PhoneRegionContext } from '@/lib/phone-identity'

/**
 * The identifiers a contact lookup may search on, in the order of confidence
 * the product uses:
 *
 *   1. a normalized phone number
 *   2. a provider identity already linked to a contact (`contact_channels`)
 *   3. an exact email address
 *
 * A display name is not an identifier and never appears here: two people share
 * a name far more often than they share a number, and a name-based "match"
 * would either open the wrong record or suppress a legitimate create.
 */
export type ContactIdentityLookup = {
  /** Normalized digits, as `public.phone_digits` produces them. */
  phoneDigits: Array<string>
  emails: Array<string>
  /** `channelType:externalId`, matched against `contact_channels`. */
  channelIdentities: Array<string>
  /**
   * Numbers that could not be placed in a country and are therefore NOT part of
   * the lookup. Kept so the card can say "this number could not be checked"
   * rather than silently reporting no match.
   */
  ambiguousPhones: Array<string>
}

export const EMPTY_CONTACT_IDENTITY: ContactIdentityLookup = {
  phoneDigits: [],
  emails: [],
  channelIdentities: [],
  ambiguousPhones: [],
}

/**
 * Region context carried by the card itself: a number that states its own
 * country lends that country to a sibling number written locally. A card is one
 * person's contact details, so its own numbers are the closest context there is.
 */
function payloadHints(contact: SharedContact): Array<string> {
  return contact.phoneNumbers
    .map((phone): string | null => regionFromExplicitNumber(phone))
    .filter((region): region is string => region !== null)
}

export function contactIdentityFromSharedContact(
  contact: SharedContact,
  context: Pick<PhoneRegionContext, 'workspaceRegion'> = {},
): ContactIdentityLookup {
  const regionContext: PhoneRegionContext = {
    hints: payloadHints(contact),
    workspaceRegion: context.workspaceRegion,
  }

  const phoneDigits = new Set<string>()
  const ambiguousPhones: Array<string> = []

  for (const phone of contact.phoneNumbers) {
    const identity = phoneIdentity(phone, regionContext)
    if (identity.status === 'ambiguous') {
      ambiguousPhones.push(phone)
      continue
    }
    for (const digits of identity.digits) phoneDigits.add(digits)
  }

  return {
    phoneDigits: [...phoneDigits],
    emails: contact.emails.map((email) => email.trim().toLowerCase()),
    channelIdentities: contact.identities.map(
      (identity) => `${identity.channelType}:${identity.externalId}`,
    ),
    ambiguousPhones,
  }
}

/** Whether the lookup can be run at all. Ambiguous numbers do not count. */
export function hasContactIdentity(lookup: ContactIdentityLookup): boolean {
  return (
    lookup.phoneDigits.length > 0 ||
    lookup.emails.length > 0 ||
    lookup.channelIdentities.length > 0
  )
}

/**
 * A stable cache key for one identity. Every list is sorted: TanStack's key hash
 * sorts object keys but not array elements, so two orderings of the same
 * identity would otherwise be two cache entries for one answer.
 */
export function contactIdentityKey(lookup: ContactIdentityLookup): string {
  return [
    [...lookup.phoneDigits].sort().join(','),
    [...lookup.emails].sort().join(','),
    [...lookup.channelIdentities].sort().join(','),
  ].join('|')
}
