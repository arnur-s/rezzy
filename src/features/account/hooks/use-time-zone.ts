import {
  getActiveTimeZone,
  setActiveTimeZone,
  subscribeToTimeZone,
} from '@/lib/time-zone'
import { useEffect, useSyncExternalStore } from 'react'
import { useMyProfile } from './use-my-profile'

/**
 * Point the app's date formatters at the account's zone once the profile row
 * arrives.
 *
 * Unlike the language preference this needs no reload: `getDateFormatter` reads
 * the zone on every call, so publishing a new one and letting React re-render
 * is enough. Nor is there a pre-mount cache to reconcile against — a timestamp
 * rendered in the browser's zone for the moment before the profile lands is the
 * right thing to show, because until then the browser is the only evidence of
 * where the reader is.
 *
 * The write is an effect rather than a render-time assignment because it
 * notifies subscribers, and a store that calls setState while another component
 * is rendering is exactly the tearing React forbids. The cost is that the first
 * frame after the profile settles is still browser-local; the frame after it is
 * correct, and no timestamp is wrong for longer than that.
 */
export function useSyncTimeZone() {
  const profileQuery = useMyProfile()
  const timezone = profileQuery.data?.timezone ?? null

  useEffect(() => {
    setActiveTimeZone(timezone)
  }, [timezone])

  // Signing out unmounts the authenticated area, and the store is module-level:
  // without this the next account to use the tab would render its first frames
  // in the previous account's zone. Kept as its own effect with an empty
  // dependency list so it fires on unmount only — hanging it off the effect
  // above would clear the zone on the way to every change of it.
  useEffect(() => {
    return () => {
      setActiveTimeZone(null)
    }
  }, [])
}

/**
 * The zone the app is currently formatting in, for the component that has to
 * name it rather than merely render a date in it. Subscribed rather than read
 * directly so it repaints when the profile lands.
 */
export function useActiveTimeZone(): string | undefined {
  return useSyncExternalStore(
    subscribeToTimeZone,
    getActiveTimeZone,
    getActiveTimeZone,
  )
}
