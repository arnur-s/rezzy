import { getUserMetadataFullName } from '@/entities/user'
import { useAuth } from '@/providers/auth-provider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { getMyProfile, updateMyProfileIdentity } from '../api/profile'
import { accountQueryKeys } from '../api/query-keys'
import type { ProfileIdentityInput, UserProfile } from '../model/types'

const ANONYMOUS = 'anonymous'

/**
 * What the account area shows before the profile row arrives, and what it falls
 * back to when the row is missing entirely. Auth metadata is the only identity
 * the client has without a round trip.
 */
export function profileFromAuthUser(user: User): UserProfile {
  const email = user.email ?? ''

  return {
    id: user.id,
    fullName: getUserMetadataFullName(user) || email.split('@')[0] || '',
    email,
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    timezone: null,
    language: 'auto',
  }
}

export function useMyProfile() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: accountQueryKeys.profile(userId ?? ANONYMOUS),
    queryFn: () => getMyProfile(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateMyProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const key = accountQueryKeys.profile(user?.id ?? ANONYMOUS)

  return useMutation({
    mutationFn: (values: ProfileIdentityInput) =>
      updateMyProfileIdentity({
        userId: user?.id as string,
        email: user?.email ?? '',
        values,
      }),
    // No optimistic write: the form is an explicit save, so the typed values
    // stay on screen either way and rolling back a half-applied row would only
    // add a flicker between the pending state and the failure message.
    onSuccess: (profile) => {
      queryClient.setQueryData<UserProfile>(key, profile)
    },
  })
}
