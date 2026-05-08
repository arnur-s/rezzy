import { describe, expect, it } from 'vitest'
import { createSlug } from './slug'

describe('createSlug', () => {
  it('normalizes whitespace and punctuation', () => {
    expect(createSlug('  Acme Operations, Inc.  ')).toBe(
      'acme-operations-inc',
    )
  })

  it('removes accents before lowercasing', () => {
    expect(createSlug('Crème Brûlée CRM')).toBe('creme-brulee-crm')
  })

  it('uses a stable fallback when no sluggable text remains', () => {
    expect(createSlug('---')).toBe('workspace')
  })
})
