import { describe, expect, it } from 'vitest'
import { formatFileSize } from './format-file-size'

describe('formatFileSize', () => {
  it('formats bytes and KB', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats MB', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('returns null for invalid input', () => {
    expect(formatFileSize(null)).toBeNull()
    expect(formatFileSize(undefined)).toBeNull()
    expect(formatFileSize(-1)).toBeNull()
    expect(formatFileSize(Number.NaN)).toBeNull()
  })
})
