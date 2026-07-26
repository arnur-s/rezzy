import { hasActiveChannel } from '@/entities/channel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activateChannel,
  channelQueryKeys,
  createInstagramChannel,
  createTelegramChannel,
  createWhatsappChannel,
  createWhatsappChannelManual,
  deactivateChannel,
  getWorkspaceChannels,
  reconnectInstagramChannel,
  reconnectWhatsappChannel,
  reconnectWhatsappChannelManual,
  updateChannelName,
} from '../api/channels'

export function useChannels(workspaceId: string) {
  return useQuery({
    queryFn: () => getWorkspaceChannels(workspaceId),
    queryKey: channelQueryKeys.list(workspaceId),
    enabled: !!workspaceId,
  })
}

export type WorkspaceReadiness = {
  /** True once the workspace has a channel that can receive conversations. */
  hasActiveChannel: boolean
  isError: boolean
  isPending: boolean
  isRetrying: boolean
  refetch: () => void
}

/**
 * Whether the workspace's inbox is usable yet.
 *
 * Selects over the channel list rather than querying separately: it shares
 * `channelQueryKeys.list`, so it costs no extra request and every existing
 * channel mutation already invalidates it. Connecting, disconnecting, deleting
 * and switching workspaces all recompute readiness with no further wiring.
 */
export function useWorkspaceReadiness(workspaceId: string): WorkspaceReadiness {
  const query = useQuery({
    queryFn: () => getWorkspaceChannels(workspaceId),
    queryKey: channelQueryKeys.list(workspaceId),
    enabled: !!workspaceId,
    select: hasActiveChannel,
  })

  return {
    hasActiveChannel: query.data ?? false,
    isError: query.isError,
    isPending: query.isPending,
    isRetrying: query.isRefetching,
    refetch: () => {
      void query.refetch()
    },
  }
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

export function useCreateWhatsappChannel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: {
      code: string
      name: string
      phoneNumberId: string
      wabaId: string
    }) => createWhatsappChannel({ ...values, workspaceId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}

export function useCreateWhatsappChannelManual(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: {
      accessToken: string
      name: string
      phoneNumberId: string
      wabaId: string
    }) => createWhatsappChannelManual({ ...values, workspaceId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}

export function useReconnectWhatsappChannel(
  workspaceId: string,
  channelId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: {
      code: string
      phoneNumberId: string
      wabaId: string
    }) =>
      reconnectWhatsappChannel({
        ...values,
        channelId,
        workspaceId,
      }),
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

export function useReconnectWhatsappChannelManual(
  workspaceId: string,
  channelId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: {
      accessToken: string
      phoneNumberId: string
      wabaId: string
    }) =>
      reconnectWhatsappChannelManual({
        ...values,
        channelId,
        workspaceId,
      }),
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

export function useCreateInstagramChannel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { code: string; state: string; name: string }) =>
      createInstagramChannel({ ...values, workspaceId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}

export function useReconnectInstagramChannel(
  workspaceId: string,
  channelId: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { code: string; state: string }) =>
      reconnectInstagramChannel({ ...values, channelId, workspaceId }),
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

export function useDeactivateChannel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deactivateChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}

export function useActivateChannel(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: activateChannel,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: channelQueryKeys.list(workspaceId),
      })
    },
  })
}
