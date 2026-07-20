export type RecentlyViewedEntry = {
  id: string
  name: string
  /** Lucide icon name for workspace entries. */
  icon?: string
  /** Workspace id for contact entries; same as id for workspace entries. */
  workspaceId?: string
  /** Timestamp of last view. */
  at: number
}

const MAX_ENTRIES = 6

export const RECENT_WORKSPACES_KEY = 'rezzy.recent.workspaces'
export const RECENT_CONTACTS_KEY = 'rezzy.recent.contacts'

export function readRecent(key: string): Array<RecentlyViewedEntry> {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

export function writeRecent(
  key: string,
  entry: Omit<RecentlyViewedEntry, 'at'>,
): Array<RecentlyViewedEntry> {
  if (typeof window === 'undefined') return []
  const current = readRecent(key)
  const next: Array<RecentlyViewedEntry> = [
    { ...entry, at: Date.now() },
    ...current.filter((e) => e.id !== entry.id),
  ].slice(0, MAX_ENTRIES)
  window.localStorage.setItem(key, JSON.stringify(next))
  return next
}

export function removeRecent(
  key: string,
  id: string,
): Array<RecentlyViewedEntry> {
  if (typeof window === 'undefined') return []
  const current = readRecent(key)
  const next = current.filter((e) => e.id !== id)
  window.localStorage.setItem(key, JSON.stringify(next))
  return next
}

function isEntry(value: unknown): value is RecentlyViewedEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.at === 'number' &&
    (v.icon === undefined || typeof v.icon === 'string') &&
    (v.workspaceId === undefined || typeof v.workspaceId === 'string')
  )
}
