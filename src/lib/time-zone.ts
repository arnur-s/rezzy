/**
 * The time zone every formatted date in the product is rendered in.
 *
 * The profile carries a zone because an operator's day is not the day their
 * laptop happens to be set to: a message that arrived at 23:40 in Berlin has to
 * read as 23:40 on the Berlin account's screen whether they open it from Berlin
 * or from a hotel in Singapore. Left to `Intl`'s default that same message
 * would move to the next day, and the "Yesterday" heading above it would move
 * with it.
 *
 * `undefined` means "follow the browser", which is both the signed-out state
 * and the state of an account that never chose a zone. It is passed straight to
 * `Intl.DateTimeFormat`, which treats an absent `timeZone` exactly that way, so
 * the unset case needs no branch anywhere downstream.
 *
 * Kept as a module-level value rather than context because the formatters are
 * plain functions called from utilities as well as from components — the same
 * reason `getLocale` is a module binding. Subscribers exist so a zone arriving
 * after mount still repaints the timestamps already on screen.
 */
let activeTimeZone: string | undefined

const listeners = new Set<() => void>()

/** The zone to format in, or `undefined` to follow the browser. */
export function getActiveTimeZone(): string | undefined {
  return activeTimeZone
}

/**
 * Point the app's formatters at a zone. A zone the runtime does not recognize
 * is dropped rather than thrown: the column is free text, and a stale IANA name
 * must degrade to browser-local time instead of breaking every timestamp on the
 * page.
 */
export function setActiveTimeZone(timeZone: string | null | undefined) {
  const next =
    timeZone && isSupportedTimeZone(timeZone) ? timeZone : undefined

  if (next === activeTimeZone) return

  activeTimeZone = next
  for (const listener of listeners) listener()
}

/** Subscribe to zone changes. Returns the unsubscribe function. */
export function subscribeToTimeZone(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}
