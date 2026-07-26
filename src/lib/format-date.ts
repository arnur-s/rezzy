import { getLocale } from '@/paraglide/runtime'

/**
 * Date and time formatters bound to the *app* locale.
 *
 * `new Intl.DateTimeFormat(undefined, …)` reads the browser's locale, not the
 * one the interface is rendered in. On a Russian UI in an en-US browser that
 * produced strings like "Участник с May 2026" — a Russian sentence with an
 * English month inside it. Every formatter in the product goes through here so
 * the two can't drift apart again.
 *
 * The locale comes from Paraglide rather than from `resolveLocale`, even though
 * `initLocale` makes them agree: a formatted date almost always sits inside a
 * translated sentence, so it has to be built from the same value that chose the
 * words around it. `resolveLocale` is also memoized for the lifetime of the
 * page, which would make this cache impossible to invalidate.
 *
 * Construction is the expensive part of `Intl`, so instances are cached — keyed
 * by locale as well as options, so a language change can never be served a
 * formatter built for the language before it.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

export function getDateFormatter(
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const locale = getLocale()
  const key = `${locale}:${JSON.stringify(options)}`

  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    formatters.set(key, formatter)
  }

  return formatter
}

/** Formats a date, returning `''` for values that aren't real dates. */
export function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (value === null || value === undefined) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return getDateFormatter(options).format(date)
}
