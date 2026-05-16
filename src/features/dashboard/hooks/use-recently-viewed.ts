import {
  RECENT_CONTACTS_KEY,
  RECENT_WORKSPACES_KEY,
  readRecent,
  writeRecent,
} from '@/features/dashboard/utils/recently-viewed-store'
import type { RecentlyViewedEntry } from '@/features/dashboard/utils/recently-viewed-store'
import { useCallback, useEffect, useState } from 'react'

type WorkspaceEntry = { id: string; name: string }
type ContactEntry = { id: string; name: string; workspaceId: string }

function useRecentList(key: string) {
  const [items, setItems] = useState<Array<RecentlyViewedEntry>>(() =>
    readRecent(key),
  )

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === key) {
        setItems(readRecent(key))
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key])

  return [items, setItems] as const
}

export function useRecentWorkspaces() {
  const [items, setItems] = useRecentList(RECENT_WORKSPACES_KEY)

  const record = useCallback((entry: WorkspaceEntry) => {
    const next = writeRecent(RECENT_WORKSPACES_KEY, {
      id: entry.id,
      name: entry.name,
    })
    setItems(next)
  }, [setItems])

  return { items, record }
}

export function useRecentContacts() {
  const [items, setItems] = useRecentList(RECENT_CONTACTS_KEY)

  const record = useCallback((entry: ContactEntry) => {
    const next = writeRecent(RECENT_CONTACTS_KEY, {
      id: entry.id,
      name: entry.name,
      workspaceId: entry.workspaceId,
    })
    setItems(next)
  }, [setItems])

  return { items, record }
}
