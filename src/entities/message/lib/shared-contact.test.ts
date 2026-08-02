import { describe, expect, it } from 'vitest'
import {
  hasSharedContactIdentity,
  parseSharedContacts,
  sharedContactToText,
} from './shared-contact'

/**
 * The two payload dialects are the ones the webhooks actually write:
 * `supabase/functions/whatsapp-webhook/lib.ts` → `contactCardToMetadata`, and
 * `supabase/functions/telegram-webhook/lib.ts` → `contactCard`.
 */
const WHATSAPP_METADATA = {
  contacts: [
    {
      name: 'Dana Abisheva',
      phones: [
        { phone: '+7 701 555 00 01', wa_id: '77015550001', type: 'MOBILE' },
      ],
      emails: [{ email: 'dana@example.com', type: 'WORK' }],
      company: 'Astana Coffee',
    },
  ],
}

const TELEGRAM_METADATA = {
  contacts: [
    {
      first_name: 'Aizhan',
      last_name: 'Serik',
      phone: '+77015550002',
      telegram_user_id: '888',
      vcard: 'BEGIN:VCARD\nEND:VCARD',
    },
  ],
}

describe('parseSharedContacts', () => {
  it('maps a WhatsApp payload onto the canonical type', () => {
    const [contact] = parseSharedContacts(WHATSAPP_METADATA)

    expect(contact).toMatchObject({
      type: 'contact',
      displayName: 'Dana Abisheva',
      firstName: null,
      lastName: null,
      company: 'Astana Coffee',
      emails: ['dana@example.com'],
      rawVCard: null,
    })
    // A wa_id is both a number and an identity. It is kept as an identity, and
    // as a number only when it is not the number the card already carries.
    expect(contact.phoneNumbers).toEqual(['+7 701 555 00 01'])
    expect(contact.identities).toEqual([
      { channelType: 'whatsapp', externalId: '77015550001' },
    ])
  })

  it('maps a Telegram payload onto the same canonical type', () => {
    const [contact] = parseSharedContacts(TELEGRAM_METADATA)

    expect(contact).toMatchObject({
      type: 'contact',
      displayName: 'Aizhan Serik',
      firstName: 'Aizhan',
      lastName: 'Serik',
      phoneNumbers: ['+77015550002'],
      emails: [],
      rawVCard: 'BEGIN:VCARD\nEND:VCARD',
    })
    expect(contact.identities).toEqual([
      { channelType: 'telegram', externalId: '888' },
    ])
  })

  it('reads every card a single message carries', () => {
    expect(
      parseSharedContacts({
        contacts: [...WHATSAPP_METADATA.contacts, ...TELEGRAM_METADATA.contacts],
      }),
    ).toHaveLength(2)
  })

  it('returns nothing for metadata that carries no contact section', () => {
    expect(parseSharedContacts({})).toEqual([])
    expect(parseSharedContacts(null)).toEqual([])
    expect(parseSharedContacts({ contacts: 'nope' })).toEqual([])
    expect(parseSharedContacts({ location: { latitude: 1 } })).toEqual([])
  })

  it('keeps a card that carries only a name, without inventing identifiers', () => {
    const [contact] = parseSharedContacts({ contacts: [{ name: 'Ivan' }] })

    expect(contact.displayName).toBe('Ivan')
    expect(contact.phoneNumbers).toEqual([])
    expect(contact.identities).toEqual([])
    expect(hasSharedContactIdentity(contact)).toBe(false)
  })

  it('does not treat blank provider strings as values', () => {
    const [contact] = parseSharedContacts({
      contacts: [{ name: '  ', first_name: 'Ivan', phone: '  ' }],
    })

    expect(contact.displayName).toBe('Ivan')
    expect(contact.phoneNumbers).toEqual([])
  })
})

describe('sharedContactToText', () => {
  it('renders what the card holds, with nothing standing in for what it does not', () => {
    const [contact] = parseSharedContacts(WHATSAPP_METADATA)

    expect(sharedContactToText(contact)).toBe(
      ['Dana Abisheva', 'Astana Coffee', '+7 701 555 00 01', 'dana@example.com'].join(
        '\n',
      ),
    )
  })

  it('keeps a second, genuinely different number', () => {
    const [contact] = parseSharedContacts({
      contacts: [
        {
          name: 'Dana',
          phones: [{ phone: '+77015550001' }, { phone: '+7 701 555 00 99' }],
        },
      ],
    })

    expect(contact.phoneNumbers).toEqual(['+77015550001', '+7 701 555 00 99'])
  })
})
