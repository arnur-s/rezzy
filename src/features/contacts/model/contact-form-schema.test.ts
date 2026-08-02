import { setLocale } from '@/paraglide/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createContactFormSchema,
  toContactWritePayload,
} from './contact-form-schema'
import type { ContactFormValues } from './contact-form-schema'

const valid: ContactFormValues = {
  name: 'Jane Doe',
  phone: '',
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
      phone: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an international phone number', () => {
    const result = createContactFormSchema({
      hasChannelIdentity: false,
    }).safeParse({
      ...valid,
      phone: '+44 20 7946 0958',
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

describe('toContactWritePayload', () => {
  it('normalises unfilled optional fields to null', () => {
    expect(
      toContactWritePayload({ ...valid, phone: '', email: '', ownerId: '' }),
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
})
