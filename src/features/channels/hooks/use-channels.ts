import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  channelQueryKeys,
  createTelegramChannel,
  deleteChannel,
  getWorkspaceChannels,
  updateChannelName,
} from '../api/channels'

export function useChannels(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspaceChannels(workspaceId),
    queryKey: channelQueryKeys.list(workspaceId),
    enabled: !!workspaceId,
  })
}

export function useCreateTelegramChannel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { botToken: string; name: string }) =>
      createTelegramChannel({ ...values, workspaceId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}

export function useUpdateChannelName(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateChannelName,
    onSuccess: async (channel) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: channelQueryKeys.list(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: channelQueryKeys.detail(channel.id),
        }),
      ])
    },
  })
}

export function useDeleteChannel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}
