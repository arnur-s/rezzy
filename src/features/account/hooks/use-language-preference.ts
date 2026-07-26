import {
  cacheLocalePreference,
  getLocalePreference,
  localePreferenceChangesRendering,
} from '@/lib/locale'
import type { LocalePreference } from '@/lib/locale'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { useToast } from '@astryxdesign/core/Toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { updateMyLanguage } from '../api/profile'
import { accountQueryKeys } from '../api/query-keys'
import type { UserProfile } from '../model/types'
import { profileFromAuthUser, useMyProfile } from './use-my-profile'

const ANONYMOUS = 'anonymous'

/**
 * Reconcile the server preference with the local cache once the profile loads.
 *
 * The server is authoritative, but only the cache is readable before React
 * mounts, so boot renders from the cache and this corrects it afterwards. The
 * reload is bounded: writing the cache first makes the next boot's comparison a
 * no-op, and a reconciliation that resolves to the same rendered locale (server
 * `auto`, cache `en`, browser `en`) updates the cache without reloading at all.
 */
export function useSyncLanguagePreference() {
  const profileQuery = useMyProfile()
  const serverPreference = profileQuery.data?.language

  useEffect(() => {
    if (!serverPreference) return
    if (serverPreference === getLocalePreference()) return

    const changesRendering = localePreferenceChangesRendering(serverPreference)
    cacheLocalePreference(serverPreference)

    if (changesRendering) {
      window.location.reload()
    }
  }, [serverPreference])
}

export type UseLanguagePreference = {
  preference: LocalePreference
  select: (next: LocalePreference) => void
  isPending: boolean
  /** True while the profile row that carries the preference is still loading. */
  isLoading: boolean
}

export function useLanguagePreference(): UseLanguagePreference {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const showToast = useToast()
  const profileQuery = useMyProfile()
  const key = accountQueryKeys.profile(user?.id ?? ANONYMOUS)

  // Holds the choice between the click and the server's answer so the control
  // never appears to snap back while the write is in flight.
  const [optimistic, setOptimistic] = useState<LocalePreference | null>(null)

  const preference =
    optimistic ?? profileQuery.data?.language ?? getLocalePreference()

  const mutation = useMutation({
    mutationFn: (language: LocalePreference) =>
      updateMyLanguage({
        userId: user?.id as string,
        email: user?.email ?? '',
        fullName:
          profileQuery.data?.fullName ??
          (user ? profileFromAuthUser(user).fullName : ''),
        language,
      }),
  })

  function select(next: LocalePreference) {
    if (next === preference || mutation.isPending) return

    const previousPreference = getLocalePreference()
    const previousProfile = queryClient.getQueryData<UserProfile>(key)

    setOptimistic(next)
    cacheLocalePreference(next)
    queryClient.setQueryData<UserProfile>(key, (current) =>
      current ? { ...current, language: next } : current,
    )

    // Signed out there is nothing to persist to, and no user row to roll back.
    if (!user) {
      setOptimistic(null)
      if (localePreferenceChangesRendering(next)) window.location.reload()
      return
    }

    mutation.mutate(next, {
      onSuccess: (profile) => {
        queryClient.setQueryData<UserProfile>(key, profile)
        // Paraglide resolves the locale once, at boot, and every `m.*()` call
        // reads that captured value — so a reload is the only way to re-render
        // the whole app in the new language. It runs after the write rather
        // than before it because a reload fired first would abort the request.
        if (localePreferenceChangesRendering(profile.language)) {
          window.location.reload()
          return
        }
        setOptimistic(null)
      },
      onError: () => {
        cacheLocalePreference(previousPreference)
        queryClient.setQueryData<UserProfile>(key, previousProfile)
        setOptimistic(null)
        showToast({
          body: m.settings_appearance_language_save_error(),
          type: 'error',
        })
      },
    })
  }

  return {
    preference,
    select,
    isPending: mutation.isPending,
    isLoading: Boolean(user) && profileQuery.isPending,
  }
}
