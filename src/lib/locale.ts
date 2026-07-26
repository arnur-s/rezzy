import type { locales } from '@/paraglide/runtime'
import {
  cookieName,
  isLocale,
  overwriteGetLocale,
  setLocale,
} from '@/paraglide/runtime'

export type AppLocale = (typeof locales)[number]

/** `'auto'` means "no explicit choice — follow the browser". */
export type LocalePreference = 'auto' | AppLocale

/** Used when neither an explicit choice nor the browser offers a match. */
const FALLBACK_LOCALE: AppLocale = 'en'

export function isLocalePreference(
  value: unknown,
): value is LocalePreference {
  return value === 'auto' || (typeof value === 'string' && isLocale(value))
}

/**
 * Paraglide's cookie is the record of an explicit choice. Its own strategy
 * would fall through to `baseLocale` when the cookie is missing, which is why
 * resolution lives here instead: the browser has to get a say in between.
 *
 * The cookie doubles as the local preference cache. Its absence already means
 * `'auto'`, so the three-way distinction survives without a second storage key,
 * and `initLocale` reads it before React mounts — which is what lets the app
 * render in the right language before the authenticated request resolves.
 */
function readChosenLocale(): AppLocale | undefined {
  if (typeof document === 'undefined') return undefined

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`),
  )
  const value = match ? decodeURIComponent(match[1]) : undefined

  return isLocale(value) ? value : undefined
}

function readBrowserLocale(): AppLocale | undefined {
  if (typeof navigator === 'undefined') return undefined

  const tags = navigator.languages.length
    ? navigator.languages
    : [navigator.language]

  for (const tag of tags) {
    // Match on the base subtag so 'ru-KZ' and 'en-GB' still resolve.
    const base = tag.split('-')[0]?.toLowerCase()
    if (isLocale(base)) return base
  }

  return undefined
}

let resolvedLocale: AppLocale | undefined

/**
 * The locale the page is currently rendered in: explicit choice, else browser,
 * else English. Memoized on purpose — messages are read throughout a render
 * pass and must not change underneath it.
 */
export function resolveLocale(): AppLocale {
  resolvedLocale ??=
    readChosenLocale() ?? readBrowserLocale() ?? FALLBACK_LOCALE
  return resolvedLocale
}

/** The locale a preference would render as, without applying it. */
export function resolveLocaleFor(preference: LocalePreference): AppLocale {
  if (preference !== 'auto') return preference
  return readBrowserLocale() ?? FALLBACK_LOCALE
}

/** What the language control should show as selected. */
export function getLocalePreference(): LocalePreference {
  return readChosenLocale() ?? 'auto'
}

/**
 * Install app locale resolution. Must run before the first message renders —
 * `getLocale` is a live binding, so every `m.*()` call picks this up.
 */
export function initLocale() {
  // Re-pin rather than reuse: this is the boot locale, and everything that
  // decides whether a preference change needs a reload compares against it.
  resolvedLocale = undefined
  const locale = resolveLocale()
  overwriteGetLocale(() => locale)
}

/**
 * Write a language choice to the local cache without re-rendering or reloading.
 * Callers that need the page to actually change language follow this with
 * `localePreferenceChangesRendering` and a reload.
 */
export function cacheLocalePreference(preference: LocalePreference) {
  if (typeof document === 'undefined') return

  if (preference === 'auto') {
    document.cookie = `${cookieName}=; path=/; max-age=0`
    return
  }

  // `reload: false` keeps this a pure cache write. Paraglide would otherwise
  // navigate immediately, which would abort any request still in flight.
  setLocale(preference, { reload: false })
}

/** True when applying `preference` would render a different language. */
export function localePreferenceChangesRendering(
  preference: LocalePreference,
): boolean {
  return resolveLocaleFor(preference) !== resolveLocale()
}
