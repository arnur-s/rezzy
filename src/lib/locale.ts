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

/**
 * Paraglide's cookie is the record of an explicit choice. Its own strategy
 * would fall through to `baseLocale` when the cookie is missing, which is why
 * resolution lives here instead: the browser has to get a say in between.
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

/** The locale in effect: explicit choice, else browser, else English. */
export function resolveLocale(): AppLocale {
  resolvedLocale ??=
    readChosenLocale() ?? readBrowserLocale() ?? FALLBACK_LOCALE
  return resolvedLocale
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
  const locale = resolveLocale()
  overwriteGetLocale(() => locale)
}

/**
 * Persist a language choice. Reloads only when the rendered language actually
 * changes; pinning the language you were already seeing is a silent no-op.
 */
export function applyLocalePreference(preference: LocalePreference) {
  if (preference !== 'auto') {
    // Writes the cookie, and reloads when it differs from the current locale.
    setLocale(preference)
    return
  }

  document.cookie = `${cookieName}=; path=/; max-age=0`

  const next = readBrowserLocale() ?? FALLBACK_LOCALE
  if (next !== resolveLocale()) {
    window.location.reload()
  }
}
