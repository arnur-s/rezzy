import { phoneNumbersMatch } from '@/lib/phone-identity'
import { z } from 'zod'

/**
 * A contact shared inside a conversation.
 *
 * Providers deliver these in their own shapes — WhatsApp sends a vCard-derived
 * object with `phones[].phone` / `phones[].wa_id`, Telegram sends
 * `first_name` / `phone_number` / `user_id` / `vcard`. Both webhooks already
 * write a near-common object into `messages.metadata.contacts` (see
 * `supabase/functions/*-webhook/lib.ts`); this module is the single place that
 * turns either dialect into one application type, so nothing downstream —
 * rendering, matching, prefill — ever branches on which provider sent it.
 */
export type SharedContactIdentity = {
  /** `contact_channels.channel_type` this identity belongs to. */
  channelType: string
  /** `contact_channels.external_id` value: a wa_id, a Telegram user id, … */
  externalId: string
}

export type SharedContact = {
  type: 'contact'
  displayName: string | null
  firstName: string | null
  lastName: string | null
  company: string | null
  phoneNumbers: Array<string>
  emails: Array<string>
  /** Provider identities that can be matched against `contact_channels`. */
  identities: Array<SharedContactIdentity>
  rawVCard: string | null
}

/**
 * The provider-written payload. `passthrough` because a webhook may add fields
 * before the client knows about them, and an unknown key must not drop a card.
 */
const sharedContactPayloadSchema = z
  .object({
    name: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    phones: z
      .array(
        z
          .object({ phone: z.string().optional(), wa_id: z.string().optional() })
          .passthrough(),
      )
      .optional(),
    emails: z
      .array(z.object({ email: z.string().optional() }).passthrough())
      .optional(),
    company: z.string().optional(),
    /** Telegram: the shared user's numeric id, as a string. */
    telegram_user_id: z.string().optional(),
    vcard: z.string().optional(),
  })
  .passthrough()

export type SharedContactPayload = z.infer<typeof sharedContactPayloadSchema>

function trimmed(value: string | undefined): string | null {
  const next = value?.trim()
  return next ? next : null
}

function metadataSection(raw: unknown, key: string): unknown {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  return (raw as Record<string, unknown>)[key] ?? null
}

/** Canonicalise one provider card. */
export function toSharedContact(payload: SharedContactPayload): SharedContact {
  const firstName = trimmed(payload.first_name)
  const lastName = trimmed(payload.last_name)
  const displayName =
    trimmed(payload.name) ??
    trimmed([firstName, lastName].filter(Boolean).join(' '))

  const phoneNumbers: Array<string> = []
  const identities: Array<SharedContactIdentity> = []

  /**
   * Keeps the first spelling of each number. A WhatsApp card carries the same
   * subscriber twice — once as a written number, once as a wa_id — and a card
   * that printed one person's number on two lines would read as two numbers.
   */
  const addPhone = (value: string) => {
    if (phoneNumbers.some((existing) => phoneNumbersMatch(existing, value))) {
      return
    }
    phoneNumbers.push(value)
  }

  const primary = trimmed(payload.phone)
  if (primary) addPhone(primary)

  for (const entry of payload.phones ?? []) {
    const phone = trimmed(entry.phone)
    if (phone) addPhone(phone)

    const waId = trimmed(entry.wa_id)
    if (waId) {
      // A wa_id is the subscriber's number without the `+`, so it is both a
      // dialable number and a WhatsApp identity. Kept as both: the number
      // matches `contacts.phone`, the identity matches `contact_channels`.
      addPhone(`+${waId}`)
      identities.push({ channelType: 'whatsapp', externalId: waId })
    }
  }

  const telegramUserId = trimmed(payload.telegram_user_id)
  if (telegramUserId) {
    identities.push({ channelType: 'telegram', externalId: telegramUserId })
  }

  const emails = new Set<string>()
  for (const entry of payload.emails ?? []) {
    const email = trimmed(entry.email)
    if (email) emails.add(email)
  }

  return {
    type: 'contact',
    displayName,
    firstName,
    lastName,
    company: trimmed(payload.company),
    phoneNumbers,
    emails: [...emails],
    identities,
    rawVCard: trimmed(payload.vcard),
  }
}

/**
 * Every contact card carried by one message's metadata. One message can share
 * several cards, so this is always a list.
 */
export function parseSharedContacts(raw: unknown): Array<SharedContact> {
  const result = z
    .array(sharedContactPayloadSchema)
    .safeParse(metadataSection(raw, 'contacts'))
  if (!result.success) return []
  return result.data.map(toSharedContact)
}

/** The strongest name the payload offers, or null when it names nobody. */
export function sharedContactName(contact: SharedContact): string | null {
  return contact.displayName
}

/** The number to show first, and the one prefilled into the contact form. */
export function sharedContactPrimaryPhone(
  contact: SharedContact,
): string | null {
  return contact.phoneNumbers[0] ?? null
}

/**
 * Whether the card carries anything that can identify a person in the CRM.
 *
 * A name is deliberately not enough: matching people by name alone merges
 * distinct contacts, and creating from a name alone manufactures duplicates.
 */
export function hasSharedContactIdentity(contact: SharedContact): boolean {
  return (
    contact.phoneNumbers.length > 0 ||
    contact.emails.length > 0 ||
    contact.identities.length > 0
  )
}

/** Plain-text rendering of everything the card holds, for "copy details". */
export function sharedContactToText(contact: SharedContact): string {
  return [
    contact.displayName,
    contact.company,
    ...contact.phoneNumbers,
    ...contact.emails,
  ]
    .filter((line): line is string => !!line)
    .join('\n')
}
