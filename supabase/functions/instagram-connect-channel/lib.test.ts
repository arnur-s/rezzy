import { describe, expect, it } from 'vitest'
import {
  hasMessagingScope,
  isProfessionalAccountType,
  normalizeAccountType,
  parseGrantedScopes,
} from './lib.ts'

describe('normalizeAccountType', () => {
  it('uppercases and trims strings', () => {
    expect(normalizeAccountType('Business')).toBe('BUSINESS')
    expect(normalizeAccountType('  media_creator ')).toBe('MEDIA_CREATOR')
  })

  it('returns empty string for non-strings', () => {
    expect(normalizeAccountType(null)).toBe('')
    expect(normalizeAccountType(undefined)).toBe('')
    expect(normalizeAccountType(42)).toBe('')
  })
})

describe('isProfessionalAccountType', () => {
  it('accepts documented professional constants regardless of case', () => {
    expect(isProfessionalAccountType('BUSINESS')).toBe(true)
    expect(isProfessionalAccountType('Business')).toBe(true)
    expect(isProfessionalAccountType('creator')).toBe(true)
    expect(isProfessionalAccountType('Media_Creator')).toBe(true)
  })

  it('rejects personal and unknown types', () => {
    expect(isProfessionalAccountType('PERSONAL')).toBe(false)
    expect(isProfessionalAccountType('')).toBe(false)
    expect(isProfessionalAccountType(null)).toBe(false)
  })
})

describe('parseGrantedScopes', () => {
  it('parses an array of scope strings', () => {
    expect(
      parseGrantedScopes(['instagram_business_basic', 'instagram_business_manage_messages']),
    ).toEqual(['instagram_business_basic', 'instagram_business_manage_messages'])
  })

  it('parses comma- and space-separated strings', () => {
    expect(parseGrantedScopes('a, b')).toEqual(['a', 'b'])
    expect(parseGrantedScopes('a b')).toEqual(['a', 'b'])
  })

  it('parses arrays of permission objects', () => {
    expect(
      parseGrantedScopes([{ permission: 'a' }, { scope: 'b' }, { other: 'c' }]),
    ).toEqual(['a', 'b'])
  })

  it('returns an empty array for missing permissions', () => {
    expect(parseGrantedScopes(null)).toEqual([])
    expect(parseGrantedScopes(undefined)).toEqual([])
    expect(parseGrantedScopes(42)).toEqual([])
  })
})

describe('hasMessagingScope', () => {
  it('detects the messaging scope', () => {
    expect(hasMessagingScope(['instagram_business_manage_messages'])).toBe(true)
    expect(hasMessagingScope(['instagram_business_basic'])).toBe(false)
    expect(hasMessagingScope([])).toBe(false)
  })
})
