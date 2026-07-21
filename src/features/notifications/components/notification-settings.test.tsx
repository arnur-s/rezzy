import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../model/types'
import type { NotificationPreferences } from '../model/types'
import { NotificationSettings } from './notification-settings'

const hoisted = vi.hoisted(() => ({
  preferencesQuery: {
    data: undefined as NotificationPreferences | undefined,
    isPending: false,
    isError: false,
  },
  updateMutate: vi.fn(),
  push: {
    isSupported: true,
    permission: 'default',
    isBusy: false,
    subscribe: vi.fn(() => Promise.resolve(true)),
    unsubscribe: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('../hooks/use-notification-preferences', () => ({
  useNotificationPreferences: () => hoisted.preferencesQuery,
  useUpdateNotificationPreferences: () => ({ mutate: hoisted.updateMutate }),
}))

vi.mock('../hooks/use-push-subscription', () => ({
  usePushSubscription: () => hoisted.push,
}))

describe('NotificationSettings', () => {
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    hoisted.preferencesQuery.data = { ...DEFAULT_NOTIFICATION_PREFERENCES }
    hoisted.preferencesQuery.isPending = false
    hoisted.preferencesQuery.isError = false
    hoisted.push.isSupported = true
    hoisted.push.permission = 'default'
    hoisted.push.isBusy = false
    hoisted.updateMutate.mockReset()
    hoisted.push.subscribe.mockReset().mockResolvedValue(true)
    hoisted.push.unsubscribe.mockReset().mockResolvedValue(undefined)
  })

  it('renders all controls with default values', () => {
    render(<NotificationSettings />)
    expect(
      screen.getByRole('switch', { name: 'In-app notifications' }),
    ).toHaveProperty('checked', true)
    expect(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    ).toHaveProperty('checked', false)
    expect(
      screen.getByRole('switch', { name: 'Notification sound' }),
    ).toHaveProperty('checked', false)
    expect(screen.getByText('Not requested')).toBeTruthy()
  })

  it('shows a loading skeleton while preferences are pending', () => {
    hoisted.preferencesQuery.isPending = true
    render(<NotificationSettings />)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('shows a load error message', () => {
    hoisted.preferencesQuery.isError = true
    render(<NotificationSettings />)
    expect(
      screen.getByText('Could not load notification preferences.'),
    ).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('toggling in-app notifications saves the new preference', () => {
    render(<NotificationSettings />)
    fireEvent.click(
      screen.getByRole('switch', { name: 'In-app notifications' }),
    )
    expect(hoisted.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ inAppEnabled: false }),
      expect.anything(),
    )
  })

  it('requests push subscription when enabling desktop notifications', () => {
    render(<NotificationSettings />)
    fireEvent.click(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    )
    expect(hoisted.push.subscribe).toHaveBeenCalledTimes(1)
  })

  it('shows denied-permission help text and disables the desktop switch', () => {
    hoisted.push.permission = 'denied'
    render(<NotificationSettings />)
    expect(screen.getByText('Denied')).toBeTruthy()
    expect(
      screen.getByText(/blocked/i, { selector: 'p' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    ).toHaveProperty('disabled', true)
  })

  it('shows unsupported browser messaging', () => {
    hoisted.push.isSupported = false
    hoisted.push.permission = 'unsupported'
    render(<NotificationSettings />)
    expect(screen.getByText('Unsupported')).toBeTruthy()
    expect(screen.getByText(/does not support/i)).toBeTruthy()
  })
})
