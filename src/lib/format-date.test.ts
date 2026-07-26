import { setLocale } from '@/paraglide/runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import { formatDate, getDateFormatter } from './format-date'

/**
 * The bug this guards: formatters were built with `undefined` as the locale,
 * which resolves to the *browser's* language rather than the interface's. On a
 * Russian UI in an English browser that rendered "Участник с May 2026".
 */
describe('formatDate', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('formats in the app locale, not the browser locale', () => {
    setLocale('ru', { reload: false })
    const ru = formatDate('2026-05-14T10:00:00Z', {
      year: 'numeric',
      month: 'long',
    })

    setLocale('en', { reload: false })
    const en = formatDate('2026-05-14T10:00:00Z', {
      year: 'numeric',
      month: 'long',
    })

    expect(ru).toContain('ма')
    expect(en).toContain('May')
    expect(ru).not.toBe(en)
  })

  it('returns an empty string for missing or unparseable values', () => {
    const options = { year: 'numeric' } as const

    expect(formatDate(null, options)).toBe('')
    expect(formatDate(undefined, options)).toBe('')
    expect(formatDate('not a date', options)).toBe('')
  })

  it('reuses one formatter per locale and option set', () => {
    const options = { day: 'numeric', month: 'short' } as const

    expect(getDateFormatter(options)).toBe(getDateFormatter(options))
  })

  it('does not serve one locale a formatter built for another', () => {
    const options = { month: 'long' } as const

    setLocale('en', { reload: false })
    const english = getDateFormatter(options)

    setLocale('ru', { reload: false })
    const russian = getDateFormatter(options)

    expect(russian).not.toBe(english)
  })
})
