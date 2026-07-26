import { useAuth } from '@/providers/auth-provider'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { removeAvatarObject, uploadAvatar } from '../api/avatar'
import { updateMyAvatarUrl } from '../api/profile'
import { accountQueryKeys } from '../api/query-keys'
import type { UserProfile } from '../model/types'
import { profileFromAuthUser, useMyProfile } from './use-my-profile'

const ANONYMOUS = 'anonymous'

/**
 * Replace or clear the avatar. The upload lands first and the profile row is
 * written second, so a failure between the two leaves an orphaned object rather
 * than a row pointing at nothing.
 */
export function useUpdateAvatar() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const profileQuery = useMyProfile()
  const key = accountQueryKeys.profile(user?.id ?? ANONYMOUS)

  const fullName =
    profileQuery.data?.fullName ??
    (user ? profileFromAuthUser(user).fullName : '')

  return useMutation({
    mutationFn: async (file: File | null): Promise<UserProfile> => {
      const userId = user?.id as string
      const previousUrl = profileQuery.data?.avatarUrl ?? null

      const avatarUrl = file
        ? await uploadAvatar({ userId, file })
        : null

      const profile = await updateMyAvatarUrl({
        userId,
        email: user?.email ?? '',
        fullName,
        avatarUrl,
      })

      // The row no longer references it, so the old object is dead weight.
      // Best-effort by design: the save has already succeeded.
      if (previousUrl && previousUrl !== avatarUrl) {
        await removeAvatarObject(previousUrl).catch(() => {})
      }

      return profile
    },
    onSuccess: (profile) => {
      queryClient.setQueryData<UserProfile>(key, profile)
    },
  })
}
