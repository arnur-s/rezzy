import { setLocale } from '@/paraglide/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createContactFormSchema,
  filledPhones,
  toContactWritePayload,
} from './contact-form-schema'
import type { ContactFormValues } from './contact-form-schema'

const valid: ContactFormValues = {
  name: 'Jane Doe',
  phones: [{ value: '' }],
  email: '',
  status: 'new',
  ownerId: '',
  tags: [],
}

describe('createContactFormSchema', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('accepts a contact identified by name alone', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      name: '  Jane Doe  ',
    })
    expect(result.success && result.data.name).toBe('Jane Doe')
  })

  it('rejects a malformed email', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts an empty optional email and phone', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      email: '',
      phones: [{ value: '' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an international phone number', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      phones: [{ value: '+44 20 7946 0958' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts several numbers on one contact', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      phones: [{ value: '+44 20 7946 0958' }, { value: '+77011234567' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a local-format number when no region is configured', () => {
    // Reading `8 (701) 123-45-67` requires knowing which country it is from,
    // and a workspace without a region has not said. Asking for the `+` beats
    // storing a number that will match the wrong person later.
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      phones: [{ value: '8 (701) 123-45-67' }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts the same local number once the workspace names a region', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
      region: 'KZ',
    }).safeParse({
      ...valid,
      phones: [{ value: '8 (701) 123-45-67' }],
    })
    expect(result.success).toBe(true)
  })

  it('counts a phone as identity when there is no name', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      name: '',
      phones: [{ value: '+44 20 7946 0958' }],
    })
    expect(result.success).toBe(true)
  })

  // The two branches of the identity rule. A contact created from an inbound
  // Telegram message has no name, phone or email, and must stay editable.
  it('requires some identity when the contact has no channel', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      name: '',
    })
    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues[0]?.path).toEqual([
      'name',
    ])
  })

  it('allows a blank name, phone and email when a channel identifies the contact', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: true,
    }).safeParse({
      ...valid,
      name: '',
    })
    expect(result.success).toBe(true)
  })
})

describe('filledPhones', () => {
  it('keeps the filled rows in order and drops the blanks', () => {
    expect(
      filledPhones([
        { value: '  +77011234567 ' },
        { value: '   ' },
        { value: '+77019998877' },
      ]),
    ).toEqual(['+77011234567', '+77019998877'])
  })
})

describe('toContactWritePayload', () => {
  it('normalises unfilled optional fields to null', () => {
    expect(
      toContactWritePayload({
        ...valid,
        phones: [{ value: '' }],
        email: '',
        ownerId: '',
      }),
    ).toEqual({
      name: 'Jane Doe',
      phone: null,
      email: null,
      status: 'new',
      ownerId: null,
      tags: [],
    })
  })

  it('keeps a blank name as null rather than an empty string', () => {
    expect(toContactWritePayload({ ...valid, name: '' }).name).toBeNull()
  })

  it('writes the first filled number as the primary', () => {
    expect(
      toContactWritePayload({
        ...valid,
        phones: [{ value: '' }, { value: '+77011234567' }],
      }).phone,
    ).toBe('+77011234567')
  })
})
