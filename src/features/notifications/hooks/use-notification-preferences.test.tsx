import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notificationQueryKeys } from '../api/query-keys'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../model/types'
import type { NotificationPreferences } from '../model/types'
import { useUpdateNotificationPreferences } from './use-notification-preferences'

const USER_ID = 'user-1'

const hoisted = vi.hoisted(() => ({
  upsert: vi.fn(),
}))

vi.mock('../api/notification-preferences', () => ({
  getMyNotificationPreferences: vi.fn(),
  upsertMyNotificationPreferences: hoisted.upsert,
}))

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: USER_ID, email: 'agent@example.com' },
    session: null,
    isLoading: false,
    signOut: vi.fn(),
  }),
}))

const KEY = notificationQueryKeys.preferences(USER_ID)

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function UpdateProbe({ next }: { next: NotificationPreferences }) {
  const update = useUpdateNotificationPreferences()

  return (
    <button type="button" onClick={() => update.mutate(next)}>
      save
    </button>
  )
}

function read(queryClient: QueryClient) {
  return queryClient.getQueryData<NotificationPreferences>(KEY)
}

describe('useUpdateNotificationPreferences', () => {
  beforeEach(() => {
    hoisted.upsert.mockReset()
  })

  it('writes the new preferences into the cache before the request finishes', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(KEY, { ...DEFAULT_NOTIFICATION_PREFERENCES })
    // Never resolves: this asserts the optimistic state, not the settled one.
    hoisted.upsert.mockReturnValue(new Promise(() => {}))

    const next: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      soundEnabled: true,
    }

    render(<UpdateProbe next={next} />, { wrapper: wrapper(queryClient) })

    fireEvent.click(screen.getByText('save'))

    // onMutate cancels in-flight queries first, so the write lands a microtask
    // later — still well before the request it is standing in for.
    await waitFor(() => expect(read(queryClient)?.soundEnabled).toBe(true))
  })

  it('restores the previous preferences when the write fails', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(KEY, { ...DEFAULT_NOTIFICATION_PREFERENCES })
    hoisted.upsert.mockRejectedValue(new Error('offline'))

    render(
      <UpdateProbe
        next={{ ...DEFAULT_NOTIFICATION_PREFERENCES, soundEnabled: true }}
      />,
      { wrapper: wrapper(queryClient) },
    )

    fireEvent.click(screen.getByText('save'))

    await waitFor(() => expect(read(queryClient)?.soundEnabled).toBe(false))
  })

  it('adopts the server response on success', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(KEY, { ...DEFAULT_NOTIFICATION_PREFERENCES })
    hoisted.upsert.mockResolvedValue({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      soundEnabled: true,
      previewMode: 'hidden',
    })

    render(
      <UpdateProbe
        next={{ ...DEFAULT_NOTIFICATION_PREFERENCES, soundEnabled: true }}
      />,
      { wrapper: wrapper(queryClient) },
    )

    fireEvent.click(screen.getByText('save'))

    await waitFor(() => expect(read(queryClient)?.previewMode).toBe('hidden'))
  })
})
