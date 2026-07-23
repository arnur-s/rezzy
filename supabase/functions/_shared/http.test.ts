import { describe, expect, it } from 'vitest'
import { timingSafeEqualStrings } from './http.ts'

describe('timingSafeEqualStrings', () => {
  it('accepts equal strings', () => {
    expect(timingSafeEqualStrings('secret-token', 'secret-token')).toBe(true)
    expect(timingSafeEqualStrings('', '')).toBe(true)
  })

  it('rejects different strings, prefixes, and length mismatches', () => {
    expect(timingSafeEqualStrings('secret-token', 'secret-tokem')).toBe(false)
    expect(timingSafeEqualStrings('secret', 'secret-token')).toBe(false)
    expect(timingSafeEqualStrings('secret-token', '')).toBe(false)
  })

  it('handles multibyte input', () => {
    expect(timingSafeEqualStrings('тайна', 'тайна')).toBe(true)
    expect(timingSafeEqualStrings('тайна', 'тайнб')).toBe(false)
  })
})
