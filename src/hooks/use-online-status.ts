import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

/** Server render has no network state; assume online so nothing is disabled. */
function getServerSnapshot(): boolean {
  return true
}

/**
 * Reactive `navigator.onLine`. Reflects the browser's own connectivity signal,
 * which is a hint (a captive portal can still report "online"), so use it to
 * pre-empt obviously-doomed actions, not as a guarantee of reachability.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
