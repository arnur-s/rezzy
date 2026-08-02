import { describe, expect, it } from 'vitest'
import {
  formatPhoneForDisplay,
  formatPhoneForStorage,
  phoneDigits,
  phoneIdentity,
  phoneLookupDigits,
  phoneNumbersMatch,
  regionFromExplicitNumber,
} from './phone-identity'

describe('phoneIdentity country resolution', () => {
  it('reads an explicit country code without any context', () => {
    const identity = phoneIdentity('+7 701 123 45 67')

    expect(identity.status).toBe('known')
    expect(identity).toMatchObject({ region: 'KZ', source: 'explicit' })
    expect(identity.digits).toContain('77011234567')
    // The country's own national form, which is where the trunk `8` comes from.
    expect(identity.digits).toContain('87011234567')
  })

  it('refuses to place a local number when nothing says which country', () => {
    // The critical case: no default region anywhere. `8 (701) …` is Kazakh in
    // Kazakhstan and something else elsewhere, so it is left unresolved rather
    // than assumed.
    expect(phoneIdentity('8 (701) 123-45-67')).toEqual({
      status: 'ambiguous',
      digits: [],
    })
    expect(phoneLookupDigits('8 (701) 123-45-67')).toEqual([])
  })

  it('takes the country from a sibling number in the same payload', () => {
    const identity = phoneIdentity('8 (701) 123-45-67', {
      hints: [regionFromExplicitNumber('+7 701 555 00 01')],
    })

    expect(identity).toMatchObject({ status: 'known', source: 'payload' })
    expect(identity.digits).toContain('77011234567')
  })

  it('falls back to the workspace region when the payload says nothing', () => {
    const identity = phoneIdentity('8 (701) 123-45-67', {
      workspaceRegion: 'KZ',
    })

    expect(identity).toMatchObject({ status: 'known', source: 'workspace' })
    expect(identity.digits).toContain('77011234567')
  })

  it('prefers the payload country over the workspace default', () => {
    const identity = phoneIdentity('020 7946 0958', {
      hints: ['GB'],
      workspaceRegion: 'KZ',
    })

    expect(identity).toMatchObject({ status: 'known', region: 'GB' })
  })

  it('ignores a region that is not a country', () => {
    expect(
      phoneIdentity('8 (701) 123-45-67', { workspaceRegion: 'not-a-country' }),
    ).toEqual({ status: 'ambiguous', digits: [] })
  })

  it('treats a fragment as ambiguous rather than as a number', () => {
    expect(phoneIdentity('45-67').status).toBe('ambiguous')
  })
})

describe('phoneNumbersMatch', () => {
  const CONTEXT = { workspaceRegion: 'KZ' }
  const SAME = ['+7 701 123 45 67', '+77011234567', '8 (701) 123-45-67']

  it('treats every common spelling of one number as the same number', () => {
    for (const left of SAME) {
      for (const right of SAME) {
        expect(phoneNumbersMatch(left, right, CONTEXT)).toBe(true)
      }
    }
  })

  it('matches a wa_id (digits, no plus) against its dialable form', () => {
    expect(phoneNumbersMatch('+77015550001', '+7 701 555 00 01')).toBe(true)
  })

  it('does not match different numbers that merely share a tail', () => {
    expect(phoneNumbersMatch('+77011234567', '+77021234567', CONTEXT)).toBe(
      false,
    )
    // Two numbers written in full stay distinct even when their national parts
    // coincide: expansion adds forms of a number already parsed, it never
    // strips a country code off a complete one.
    expect(phoneNumbersMatch('+12025550143', '+72025550143')).toBe(false)
  })

  it('compares unplaceable input literally, which is only safe within one payload', () => {
    expect(phoneNumbersMatch('123-456', '123456')).toBe(true)
    expect(phoneNumbersMatch('123-456', '123457')).toBe(false)
    expect(phoneNumbersMatch('', '+77011234567')).toBe(false)
  })
})

describe('phoneLookupDigits', () => {
  it('is what a workspace lookup searches for', () => {
    expect(phoneLookupDigits('+77011234567').sort()).toEqual(
      ['77011234567', '87011234567'].sort(),
    )
  })

  it('is empty for an ambiguous number, so it cannot be matched on', () => {
    expect(phoneLookupDigits('701 123 45 67')).toEqual([])
  })
})

describe('formatting helpers', () => {
  it('stores E.164 and displays the grouped international form', () => {
    expect(formatPhoneForStorage('8 (701) 123-45-67', { workspaceRegion: 'KZ' })).toBe(
      '+77011234567',
    )
    expect(formatPhoneForDisplay('+77011234567')).toBe('+7 701 123 4567')
  })

  it('hands back a number it cannot place exactly as written', () => {
    // Not reformatted as if a country had been assumed.
    expect(formatPhoneForStorage('8 (701) 123-45-67')).toBe('8 (701) 123-45-67')
    expect(formatPhoneForDisplay('8 (701) 123-45-67')).toBe('8 (701) 123-45-67')
    expect(formatPhoneForStorage('ext 4021')).toBe('ext 4021')
  })

  it('strips every non-digit', () => {
    expect(phoneDigits('+7 (701) 123-45-67')).toBe('77011234567')
  })
})

describe('regionFromExplicitNumber', () => {
  it('reports the country a number states about itself', () => {
    expect(regionFromExplicitNumber('+44 20 7946 0958')).toBe('GB')
    expect(regionFromExplicitNumber('8 701 123 45 67')).toBeNull()
    expect(regionFromExplicitNumber(null)).toBeNull()
  })
})
