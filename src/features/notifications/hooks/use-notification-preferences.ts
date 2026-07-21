import { useAuth } from '@/providers/auth-provider'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMyNotificationPreferences,
  upsertMyNotificationPreferences,
} from '../api/notification-preferences'
import { notificationQueryKeys } from '../api/query-keys'
import type { NotificationPreferences } from '../model/types'

const ANONYMOUS = 'anonymous'

export function useNotificationPreferences() {
  const { user } = useAuth()
  const userId = user?.id

  return useQuery({
    queryKey: notificationQueryKeys.preferences(userId ?? ANONYMOUS),
    queryFn: () => getMyNotificationPreferences(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateNotificationPreferences() {
  const { user } = useAuth()
  const userId = user?.id
  const queryClient = useQueryClient()
  const key = notificationQueryKeys.preferences(userId ?? ANONYMOUS)

  return useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      upsertMyNotificationPreferences(userId as string, preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot =
        queryClient.getQueryData<NotificationPreferences>(key)
      queryClient.setQueryData<NotificationPreferences>(key, preferences)
      return { snapshot }
    },
    onError: (_error, _preferences, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(key, context.snapshot)
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<NotificationPreferences>(key, result)
    },
  })
}
