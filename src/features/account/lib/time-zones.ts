/**
 * The browser's own IANA time zone database. No bundled list to go stale, and
 * no dependency — but `supportedValuesOf` is not universal, so callers get an
 * empty list rather than a crash where it is missing.
 */
export function listTimeZones(): Array<string> {
  if (typeof Intl.supportedValuesOf !== 'function') return []

  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return []
  }
}

/** The zone the browser is in, used to offer a sensible default. */
export function getBrowserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

// Building a DateTimeFormat is the expensive part, and the IANA list runs to
// several hundred zones. Only the handful the dropdown actually shows are ever
// formatted, and each one is computed at most once.
const offsetCache = new Map<string, string>()

/**
 * `GMT+02:00` for a zone, so the list is scannable by offset as well as by
 * name. Falls back to an empty string when the zone is not recognized.
 */
export function formatTimeZoneOffset(timeZone: string): string {
  const cached = offsetCache.get(timeZone)
  if (cached !== undefined) return cached

  let offset = ''
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date())

    offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  } catch {
    offset = ''
  }

  offsetCache.set(timeZone, offset)
  return offset
}

/** `Europe/Berlin` reads better as `Europe / Berlin`. */
export function formatTimeZoneLabel(timeZone: string): string {
  return timeZone.split('_').join(' ')
}

export function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}
