import { cookieName } from '@/paraglide/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `resolveLocale` memoizes the locale the page booted with, so every case has
 * to start from a fresh module instance.
 */
async function loadLocale() {
  vi.resetModules()
  return import('./locale')
}

function setCookie(value: string | null) {
  document.cookie = value
    ? `${cookieName}=${value}; path=/`
    : `${cookieName}=; path=/; max-age=0`
}

function setBrowserLanguages(languages: Array<string>) {
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    get: () => languages,
  })
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    get: () => languages[0] ?? 'en',
  })
}

describe('locale resolution', () => {
  beforeEach(() => {
    setCookie(null)
    setBrowserLanguages(['en-US'])
  })

  afterEach(() => {
    setCookie(null)
  })

  it('resolves an explicit English choice', async () => {
    setCookie('en')
    setBrowserLanguages(['ru-RU'])

    const locale = await loadLocale()

    expect(locale.getLocalePreference()).toBe('en')
    expect(locale.resolveLocale()).toBe('en')
  })

  it('resolves an explicit Russian choice over the browser language', async () => {
    setCookie('ru')
    setBrowserLanguages(['en-US'])

    const locale = await loadLocale()

    expect(locale.getLocalePreference()).toBe('ru')
    expect(locale.resolveLocale()).toBe('ru')
  })

  it('resolves auto from the browser language, matching on the base subtag', async () => {
    setBrowserLanguages(['ru-KZ'])

    const locale = await loadLocale()

    expect(locale.getLocalePreference()).toBe('auto')
    expect(locale.resolveLocale()).toBe('ru')
  })

  it('falls back to English when the browser offers no supported language', async () => {
    setBrowserLanguages(['de-DE', 'fr'])

    const locale = await loadLocale()

    expect(locale.getLocalePreference()).toBe('auto')
    expect(locale.resolveLocale()).toBe('en')
  })

  it('ignores a cookie holding an unsupported locale', async () => {
    setCookie('de')
    setBrowserLanguages(['ru-RU'])

    const locale = await loadLocale()

    expect(locale.getLocalePreference()).toBe('auto')
    expect(locale.resolveLocale()).toBe('ru')
  })

  // Signed out there is no server preference at all: the cache is the whole
  // story, and it still has to distinguish an explicit choice from 'auto'.
  it('uses the cached preference for a signed-out visitor', async () => {
    setCookie('ru')
    setBrowserLanguages(['en-US'])

    const locale = await loadLocale()

    expect(locale.getLocalePreference()).toBe('ru')
    expect(locale.resolveLocale()).toBe('ru')
  })

  it('resolves a preference without applying it', async () => {
    setBrowserLanguages(['ru-RU'])

    const locale = await loadLocale()

    expect(locale.resolveLocaleFor('auto')).toBe('ru')
    expect(locale.resolveLocaleFor('en')).toBe('en')
    expect(locale.resolveLocaleFor('ru')).toBe('ru')
  })
})

describe('locale preference cache', () => {
  beforeEach(() => {
    setCookie(null)
    setBrowserLanguages(['en-US'])
  })

  it('writes an explicit choice without reloading', async () => {
    const locale = await loadLocale()

    locale.cacheLocalePreference('ru')

    expect(document.cookie).toContain(`${cookieName}=ru`)
    expect(locale.getLocalePreference()).toBe('ru')
  })

  it('clears the cookie for auto', async () => {
    setCookie('ru')
    const locale = await loadLocale()

    locale.cacheLocalePreference('auto')

    expect(locale.getLocalePreference()).toBe('auto')
  })

  it('reports whether a preference would change the rendered language', async () => {
    setCookie('en')
    setBrowserLanguages(['ru-RU'])

    const locale = await loadLocale()

    expect(locale.localePreferenceChangesRendering('en')).toBe(false)
    expect(locale.localePreferenceChangesRendering('ru')).toBe(true)
    // 'auto' resolves to the browser's Russian, so it does change it.
    expect(locale.localePreferenceChangesRendering('auto')).toBe(true)
  })

  it('treats auto as unchanged when the browser already matches', async () => {
    setCookie('en')
    setBrowserLanguages(['en-GB'])

    const locale = await loadLocale()

    expect(locale.localePreferenceChangesRendering('auto')).toBe(false)
  })

  it('narrows arbitrary strings to the three supported preferences', async () => {
    const locale = await loadLocale()

    expect(locale.isLocalePreference('auto')).toBe(true)
    expect(locale.isLocalePreference('en')).toBe(true)
    expect(locale.isLocalePreference('ru')).toBe(true)
    expect(locale.isLocalePreference('de')).toBe(false)
    expect(locale.isLocalePreference(null)).toBe(false)
  })
})
