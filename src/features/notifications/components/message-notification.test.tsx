import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { buildMessageNotificationDetails } from '../model/notification-fixtures'
import type { NotificationGroup } from '../utils/notification-group-store'
import { MessageNotification } from './message-notification'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

function groupOf(
  ...items: Array<Parameters<typeof buildMessageNotificationDetails>[0]>
): NotificationGroup {
  return {
    items: items.map((overrides) => buildMessageNotificationDetails(overrides)),
    total: items.length,
  }
}

describe('MessageNotification', () => {
  beforeAll(() => {
    setLocale('en')
  })

  it('renders name, preview and relative time only', () => {
    render(
      <MessageNotification
        group={groupOf({})}
        previewMode="full"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('Maria')).toBeTruthy()
    expect(screen.getByText(/I still need help with my order/i)).toBeTruthy()
    expect(screen.queryByText('Acme Support')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open thread' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Show full message' }),
    ).toBeNull()
  })

  it('navigates when the toast body is clicked', () => {
    const onOpen = vi.fn()
    render(
      <MessageNotification
        group={groupOf({})}
        previewMode="full"
        onOpen={onOpen}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Maria/ }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders no expand chip for a single message', () => {
    render(
      <MessageNotification
        group={groupOf({})}
        previewMode="full"
        onOpen={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /Show \d+ more message/ }),
    ).toBeNull()
  })

  it('renders every grouped message with a chip counting the total', () => {
    const group = groupOf(
      {
        id: 'n1',
        message: {
          ...buildMessageNotificationDetails().message,
          id: 'm1',
          content: 'First question',
        },
      },
      {
        id: 'n2',
        message: {
          ...buildMessageNotificationDetails().message,
          id: 'm2',
          content: 'Second question',
        },
      },
    )
    render(
      <MessageNotification group={group} previewMode="full" onOpen={vi.fn()} />,
    )
    expect(screen.getByText('First question')).toBeTruthy()
    expect(screen.getByText('Second question')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Show 1 more message' }),
    ).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('toggles the chip between expand and collapse without navigating', () => {
    const onOpen = vi.fn()
    const group = groupOf({ id: 'n1' }, { id: 'n2' })
    render(
      <MessageNotification group={group} previewMode="full" onOpen={onOpen} />,
    )
    const chip = screen.getByRole('button', { name: 'Show 1 more message' })
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(chip)
    const collapse = screen.getByRole('button', { name: 'Show fewer messages' })
    expect(collapse.getAttribute('aria-expanded')).toBe('true')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('counts messages dropped by the retention cap', () => {
    const group: NotificationGroup = {
      items: [buildMessageNotificationDetails({ id: 'n9' })],
      total: 7,
    }
    render(
      <MessageNotification group={group} previewMode="full" onOpen={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: 'Show 6 more messages' }),
    ).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
  })

  it('hides sender, content and the group in hidden preview mode', () => {
    const group = groupOf({ id: 'n1' }, { id: 'n2' })
    render(
      <MessageNotification
        group={group}
        previewMode="hidden"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.queryByText('Maria')).toBeNull()
    expect(screen.queryByText(/I still need help with my order/i)).toBeNull()
    expect(screen.getByText('New message')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Show \d+ more message/ }),
    ).toBeNull()
  })
})
