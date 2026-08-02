import { parseSharedContacts } from '@/entities/message'
import type { SharedContact } from '@/entities/message'
import { describe, expect, it } from 'vitest'
import {
  contactIdentityFromSharedContact,
  contactIdentityKey,
  hasContactIdentity,
} from './contact-identity'

function card(payload: Record<string, unknown>): SharedContact {
  return parseSharedContacts({ contacts: [payload] })[0]
}

describe('contactIdentityFromSharedContact', () => {
  it('normalizes an explicit number into the digits the database compares', () => {
    const lookup = contactIdentityFromSharedContact(
      card({ name: 'Dana', phone: '+7 701 123 45 67' }),
    )

    expect(lookup.phoneDigits).toContain('77011234567')
    expect(lookup.phoneDigits).toContain('87011234567')
    expect(lookup.ambiguousPhones).toEqual([])
    expect(hasContactIdentity(lookup)).toBe(true)
  })

  it('sets a local number aside instead of guessing its country', () => {
    const lookup = contactIdentityFromSharedContact(
      card({ name: 'Dana', phone: '8 (701) 123-45-67' }),
    )

    expect(lookup.phoneDigits).toEqual([])
    expect(lookup.ambiguousPhones).toEqual(['8 (701) 123-45-67'])
    // Nothing to look up: the card must say it could not check, not that the
    // person is absent.
    expect(hasContactIdentity(lookup)).toBe(false)
  })

  it('reads a local number under the workspace region when there is one', () => {
    const lookup = contactIdentityFromSharedContact(
      card({ name: 'Dana', phone: '8 (701) 123-45-67' }),
      { workspaceRegion: 'KZ' },
    )

    expect(lookup.phoneDigits).toContain('77011234567')
    expect(lookup.ambiguousPhones).toEqual([])
  })

  it('lends the country of one number to another on the same card', () => {
    const lookup = contactIdentityFromSharedContact(
      card({
        name: 'Dana',
        phones: [{ phone: '+7 701 555 00 01' }, { phone: '8 (701) 123-45-67' }],
      }),
    )

    expect(lookup.phoneDigits).toContain('77015550001')
    expect(lookup.phoneDigits).toContain('77011234567')
    expect(lookup.ambiguousPhones).toEqual([])
  })

  it('carries provider identities and lowercased emails', () => {
    const lookup = contactIdentityFromSharedContact(
      card({
        name: 'Dana',
        phones: [{ wa_id: '77011234567' }],
        emails: [{ email: 'Dana@Example.com' }],
      }),
    )

    expect(lookup.channelIdentities).toEqual(['whatsapp:77011234567'])
    expect(lookup.emails).toEqual(['dana@example.com'])
  })

  it('never carries the display name', () => {
    const lookup = contactIdentityFromSharedContact(card({ name: 'Dana' }))

    expect(hasContactIdentity(lookup)).toBe(false)
    expect(JSON.stringify(lookup)).not.toContain('Dana')
  })
})

describe('contactIdentityKey', () => {
  it('is stable regardless of the order the identifiers arrived in', () => {
    const a = contactIdentityFromSharedContact(
      card({ phones: [{ phone: '+77011234567' }, { phone: '+77019998877' }] }),
    )
    const b = contactIdentityFromSharedContact(
      card({ phones: [{ phone: '+77019998877' }, { phone: '+77011234567' }] }),
    )

    expect(contactIdentityKey(a)).toBe(contactIdentityKey(b))
  })

  it('separates two different people', () => {
    expect(
      contactIdentityKey(
        contactIdentityFromSharedContact(card({ phone: '+77011234567' })),
      ),
    ).not.toBe(
      contactIdentityKey(
        contactIdentityFromSharedContact(card({ phone: '+77021234567' })),
      ),
    )
  })
})
