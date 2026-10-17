import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationPreferences } from '../model/types'
import { useMessageNotifications } from './use-message-notifications'

const mocks = vi.hoisted(() => {
  const context: {
    userId: string | null
    params: { id?: string; conversationId?: string }
    preferences: NotificationPreferences
  } = {
    userId: 'user-1',
    params: {},
    preferences: {
      inAppEnabled: true,
      desktopEnabled: false,
      soundEnabled: true,
      previewMode: 'full',
    },
  }
  return {
    ...context,
    details: vi.fn(),
    showMessage: vi.fn(),
    sound: vi.fn(),
    handlers: new Map<
      string,
      (payload: { new: Record<string, unknown> }) => void
    >(),
  }
})

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mocks.userId ? { id: mocks.userId } : null }),
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => mocks.params,
}))
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('../api/notifications', () => ({
  getMessageNotificationDetails: mocks.details,
}))
vi.mock('./use-notification-preferences', () => ({
  useNotificationPreferences: () => ({ data: mocks.preferences }),
}))
vi.mock('../components/message-notification', () => ({
  showMessageNotificationToast: mocks.showMessage,
}))
vi.mock('../components/invitation-notification', () => ({
  findInvitationWorkspaceName: vi.fn(),
  invitationPresentationKey: vi.fn(),
  shouldPresentInvitation: vi.fn(),
  showInvitationNotificationToast: vi.fn(),
}))
vi.mock('../utils/sound', () => ({
  playNotificationSound: mocks.sound,
  primeNotificationSound: vi.fn(),
}))
vi.mock('@/features/workspaces/api/workspace-membership', () => ({
  listMyInvitations: vi.fn(),
}))
vi.mock('@/utils/supabase', () => ({
  supabase: {
    channel: () => {
      const channel = {
        on: (
          _event: string,
          config: { table: string },
          handler: (payload: { new: Record<string, unknown> }) => void,
        ) => {
          mocks.handlers.set(config.table, handler)
          return channel
        },
        subscribe: () => channel,
      }
      return channel
    },
    removeChannel: vi.fn(),
  },
}))

function wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function notify() {
  mocks.handlers.get('message_notifications')?.({
    new: {
      id: 'notification-1',
      recipient_id: 'user-1',
      workspace_id: 'workspace-1',
      conversation_id: 'conversation-1',
      message_id: 'message-1',
    },
  })
}

describe('notification hydration lifecycle', () => {
  beforeEach(() => {
    mocks.userId = 'user-1'
    mocks.params = {}
    mocks.preferences = {
      inAppEnabled: true,
      desktopEnabled: false,
      soundEnabled: true,
      previewMode: 'full',
    }
    mocks.handlers.clear()
    mocks.details.mockReset()
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })
  afterEach(() => vi.restoreAllMocks())

  it.each([
    'sign-out',
    'user-switch',
    'open-thread',
    'disable',
    'unmount',
  ] as const)('suppresses a pending notification after %s', async (change) => {
    let resolveDetails: (value: { id: string }) => void = () => {
      throw new Error('No hydration')
    }
    mocks.details.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetails = resolve
        }),
    )
    const { rerender, unmount } = renderHook(() => useMessageNotifications(), {
      wrapper,
    })
    notify()
    expect(mocks.details).toHaveBeenCalledTimes(1)
    if (change === 'sign-out') mocks.userId = null
    if (change === 'user-switch') mocks.userId = 'user-2'
    if (change === 'open-thread')
      mocks.params = { id: 'workspace-1', conversationId: 'conversation-1' }
    if (change === 'disable')
      mocks.preferences = { ...mocks.preferences, inAppEnabled: false }
    if (change === 'unmount') unmount()
    else rerender()
    await act(() => Promise.resolve(resolveDetails({ id: 'notification-1' })))
    expect(mocks.showMessage).not.toHaveBeenCalled()
    expect(mocks.sound).not.toHaveBeenCalled()
  })

  it('uses current privacy and sound preferences after hydration finishes', async () => {
    let resolveDetails: (value: { id: string }) => void = () => {
      throw new Error('No hydration')
    }
    mocks.details.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDetails = resolve
        }),
    )
    const { rerender } = renderHook(() => useMessageNotifications(), {
      wrapper,
    })
    notify()
    mocks.preferences = {
      ...mocks.preferences,
      previewMode: 'hidden',
      soundEnabled: false,
    }
    rerender()
    await act(() => Promise.resolve(resolveDetails({ id: 'notification-1' })))
    expect(mocks.showMessage).toHaveBeenCalledWith(
      expect.objectContaining({ previewMode: 'hidden' }),
    )
    expect(mocks.sound).not.toHaveBeenCalled()
  })

  it('contains a failed details lookup without an unhandled rejection or broken toast', async () => {
    mocks.details.mockRejectedValue(new Error('Unavailable'))
    renderHook(() => useMessageNotifications(), { wrapper })
    await act(() => Promise.resolve(notify()))
    expect(mocks.showMessage).not.toHaveBeenCalled()
  })
})
