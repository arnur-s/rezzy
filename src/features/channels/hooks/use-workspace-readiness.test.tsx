import type { Channel } from '@/entities/channel'
import type * as ChannelsApi from '../api/channels'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { channelQueryKeys } from '../api/channels'
import { useChannels, useWorkspaceReadiness } from './use-channels'

const getWorkspaceChannelsMock = vi.hoisted(() => vi.fn())

vi.mock('../api/channels', async () => {
  const actual = await vi.importActual<typeof ChannelsApi>('../api/channels')
  return { ...actual, getWorkspaceChannels: getWorkspaceChannelsMock }
})

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    api_version: null,
    created_at: '2026-07-26T00:00:00.000Z',
    id: 'channel-1',
    is_active: true,
    last_error_at: null,
    last_error_code: null,
    last_outbound_at: null,
    last_webhook_at: null,
    name: 'Support bot',
    provider_account_id: null,
    type: 'telegram',
    updated_at: '2026-07-26T00:00:00.000Z',
    workspace_id: 'workspace-1',
    ...overrides,
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useWorkspaceReadiness', () => {
  beforeEach(() => {
    getWorkspaceChannelsMock.mockReset()
  })

  it('reports a workspace with an active channel as ready', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([channel({ is_active: true })])

    const { result } = renderHook(() => useWorkspaceReadiness('workspace-1'), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.hasActiveChannel).toBe(true)
  })

  it('reports a workspace whose only channel is disconnected as not ready', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([channel({ is_active: false })])

    const { result } = renderHook(() => useWorkspaceReadiness('workspace-1'), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.hasActiveChannel).toBe(false)
  })

  // The route gate must hold rather than redirect while this is unknown.
  it('is pending, and not ready, before the channel list arrives', () => {
    getWorkspaceChannelsMock.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useWorkspaceReadiness('workspace-1'), {
      wrapper: createWrapper(createQueryClient()),
    })

    expect(result.current.isPending).toBe(true)
    expect(result.current.hasActiveChannel).toBe(false)
  })

  it('surfaces a failed channel list as an error rather than as not ready', async () => {
    getWorkspaceChannelsMock.mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useWorkspaceReadiness('workspace-1'), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.isPending).toBe(false)
  })

  // Sharing the channel list's key is what keeps readiness correct after every
  // connect, disconnect and delete without extra invalidation wiring — and what
  // stops the gate from doubling the requests on every inbox visit.
  it('shares the channel list query rather than fetching its own copy', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([channel({ is_active: true })])
    const queryClient = createQueryClient()

    const { result } = renderHook(
      () => ({
        channels: useChannels('workspace-1'),
        readiness: useWorkspaceReadiness('workspace-1'),
      }),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => {
      expect(result.current.readiness.hasActiveChannel).toBe(true)
    })

    expect(result.current.channels.data).toHaveLength(1)
    expect(getWorkspaceChannelsMock).toHaveBeenCalledTimes(1)
    expect(
      queryClient.getQueryData(channelQueryKeys.list('workspace-1')),
    ).toHaveLength(1)
  })

  // The inbox gate holds on a failed channel list rather than redirecting, so
  // the only way forward is retrying the query it holds on.
  it('can retry a failed channel list', async () => {
    getWorkspaceChannelsMock.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() => useWorkspaceReadiness('workspace-1'), {
      wrapper: createWrapper(createQueryClient()),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    getWorkspaceChannelsMock.mockResolvedValue([channel({ is_active: true })])
    result.current.refetch()

    await waitFor(() => {
      expect(result.current.hasActiveChannel).toBe(true)
    })
    expect(result.current.isError).toBe(false)
  })

  it('recalculates for the workspace it is given', async () => {
    getWorkspaceChannelsMock.mockImplementation((workspaceId: string) =>
      Promise.resolve(
        workspaceId === 'ready' ? [channel({ is_active: true })] : [],
      ),
    )

    const { result, rerender } = renderHook(
      ({ workspaceId }: { workspaceId: string }) =>
        useWorkspaceReadiness(workspaceId),
      {
        initialProps: { workspaceId: 'ready' },
        wrapper: createWrapper(createQueryClient()),
      },
    )

    await waitFor(() => {
      expect(result.current.hasActiveChannel).toBe(true)
    })

    rerender({ workspaceId: 'empty' })

    await waitFor(() => {
      expect(result.current.hasActiveChannel).toBe(false)
    })
  })
})
