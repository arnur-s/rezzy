import { useAuth } from '@/providers/auth-provider'
import { supabase } from '@/utils/supabase'
import { useMutation } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { useMemo } from 'react'

/**
 * Providers this account can authenticate with, straight from the session —
 * no linking or unlinking, just what is actually true right now.
 */
export function getAuthProviders(user: User | null): Array<string> {
  if (!user) return []

  const fromIdentities = (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider): provider is string => Boolean(provider))

  if (fromIdentities.length > 0) {
    return Array.from(new Set(fromIdentities))
  }

  // Sessions issued before identities were populated still carry the provider
  // in app_metadata.
  const metadata = user.app_metadata
  const providers = Array.isArray(metadata.providers)
    ? metadata.providers.filter(
        (provider): provider is string => typeof provider === 'string',
      )
    : []

  if (providers.length > 0) return Array.from(new Set(providers))

  return typeof metadata.provider === 'string' ? [metadata.provider] : []
}

/**
 * Whether a password is one of this account's credentials. Unknown counts as
 * yes: the only sign-up path in the app is email and password, and the server
 * rejects the change anyway if it turns out not to apply.
 */
export function hasPasswordIdentity(user: User | null): boolean {
  const providers = getAuthProviders(user)
  if (providers.length === 0) return true
  return providers.includes('email')
}

export function useAccountSecurity() {
  const { user } = useAuth()

  return useMemo(
    () => ({
      email: user?.email ?? '',
      providers: getAuthProviders(user),
      canChangePassword: hasPasswordIdentity(user),
    }),
    [user],
  )
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
  })
}

/** Revokes every other session and leaves this one signed in. */
export function useSignOutOtherSessions() {
  const { signOut } = useAuth()

  return useMutation({
    mutationFn: () => signOut('others'),
  })
}
