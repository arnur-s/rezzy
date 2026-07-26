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
    isFetching: false,
    refetch: vi.fn(),
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

  // The account preferences come from the server; the desktop toggle and the
  // permission readout belong to the browser. Only the first group depends on
  // the query, so only the first group disappears while it is unresolved.
  it('shows a loading skeleton while preferences are pending', () => {
    hoisted.preferencesQuery.isPending = true
    render(<NotificationSettings />)
    expect(
      screen.queryByRole('switch', { name: 'In-app notifications' }),
    ).toBeNull()
    expect(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    ).toBeTruthy()
  })

  it('shows a load error message', () => {
    hoisted.preferencesQuery.isError = true
    render(<NotificationSettings />)
    expect(
      screen.getByText('Could not load notification preferences.'),
    ).toBeTruthy()
    expect(
      screen.queryByRole('switch', { name: 'In-app notifications' }),
    ).toBeNull()
    // Unusable without a preference to pair it with, but still visible so the
    // browser permission state stays readable.
    expect(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    ).toHaveProperty('disabled', true)
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

  it('reflects a granted permission and lets the toggle follow the preference', () => {
    hoisted.push.permission = 'granted'
    hoisted.preferencesQuery.data = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      desktopEnabled: true,
    }
    render(<NotificationSettings />)

    expect(screen.getByText('Granted')).toBeTruthy()
    const desktop = screen.getByRole('switch', {
      name: 'Desktop notifications',
    })
    expect(desktop).toHaveProperty('checked', true)
    expect(desktop).toHaveProperty('disabled', false)
  })

  // Permission granted in the browser is not the same as the user wanting
  // desktop notifications — the toggle still follows the stored preference.
  it('stays off when permission is granted but the preference is not set', () => {
    hoisted.push.permission = 'granted'
    hoisted.preferencesQuery.data = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      desktopEnabled: false,
    }
    render(<NotificationSettings />)

    expect(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    ).toHaveProperty('checked', false)
  })

  it('never reports permission as granted when it is only requestable', () => {
    hoisted.push.permission = 'default'
    hoisted.preferencesQuery.data = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      desktopEnabled: true,
    }
    render(<NotificationSettings />)

    expect(screen.getByText('Not requested')).toBeTruthy()
    expect(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    ).toHaveProperty('checked', false)
  })

  it('does not request permission again once it has been denied', () => {
    hoisted.push.permission = 'denied'
    render(<NotificationSettings />)

    fireEvent.click(
      screen.getByRole('switch', { name: 'Desktop notifications' }),
    )

    expect(hoisted.push.subscribe).not.toHaveBeenCalled()
  })

  it('shows unsupported browser messaging', () => {
    hoisted.push.isSupported = false
    hoisted.push.permission = 'unsupported'
    render(<NotificationSettings />)
    expect(screen.getByText('Unsupported')).toBeTruthy()
    expect(screen.getByText(/does not support/i)).toBeTruthy()
  })
})
