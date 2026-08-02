import { setLocale } from '@/paraglide/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  contactDisplayName,
  contactListDisplayName,
} from './contact-display-name'

describe('contactDisplayName', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('prefers the contact name', () => {
    expect(
      contactDisplayName({
        name: 'Jane Doe',
        contact_channels: [{ external_name: 'jane_tg' }],
      }),
    ).toBe('Jane Doe')
  })

  it('falls back to a channel handle when the contact has no name', () => {
    expect(
      contactDisplayName({
        name: null,
        contact_channels: [{ external_name: 'jane_tg' }],
      }),
    ).toBe('jane_tg')
  })

  it('treats a whitespace-only name as absent', () => {
    expect(
      contactDisplayName({
        name: '   ',
        contact_channels: [{ external_name: 'jane_tg' }],
      }),
    ).toBe('jane_tg')
  })

  it('skips channels whose handle is blank', () => {
    expect(
      contactDisplayName({
        name: null,
        contact_channels: [
          { external_name: '  ' },
          { external_name: 'second' },
        ],
      }),
    ).toBe('second')
  })

  it('falls back to the placeholder with neither a name nor a handle', () => {
    expect(contactDisplayName({ name: null, contact_channels: [] })).toBe(
      'Unnamed contact',
    )
  })

  it('handles a contact loaded without its channels', () => {
    expect(contactDisplayName({ name: null })).toBe('Unnamed contact')
  })
})

describe('contactListDisplayName', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('passes through the server-computed display name', () => {
    expect(contactListDisplayName('bravo_tg')).toBe('bravo_tg')
  })

  it('applies the placeholder when the server had nothing to show', () => {
    expect(contactListDisplayName(null)).toBe('Unnamed contact')
    expect(contactListDisplayName('  ')).toBe('Unnamed contact')
  })
})
