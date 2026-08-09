import type { ShowToastFn, ToastOptions } from '@astryxdesign/core/Toast'
import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { isValidElement } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMessageNotificationDetails } from '../model/notification-fixtures'
import type { NotificationGroup } from '../utils/notification-group-store'
import { resetNotificationGroups } from '../utils/notification-group-store'
import {
  MessageNotification,
  showMessageNotificationToast,
} from './message-notification'

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

/** A `showToast` stub that records every call instead of rendering anything. */
function createFakeShowToast() {
  const calls: Array<ToastOptions> = []
  const showToast: ShowToastFn = (options) => {
    calls.push(options)
    return () => {}
  }
  return { showToast, calls }
}

/** Reads the `group` prop out of the `<MessageNotification>` element passed as `body`. */
function groupFromBody(body: ToastOptions['body']): NotificationGroup {
  if (!isValidElement<{ group: NotificationGroup }>(body)) {
    throw new Error('expected the toast body to be a MessageNotification element')
  }
  return body.props.group
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

  it('opens the group on hover and closes once the pointer leaves', () => {
    const group = groupOf({ id: 'n1' }, { id: 'n2' })
    const { container } = render(
      <MessageNotification group={group} previewMode="full" onOpen={vi.fn()} />,
    )
    const row = container.firstElementChild
    if (!row) throw new Error('expected a root row element')

    expect(
      screen
        .getByRole('button', { name: 'Show 1 more message' })
        .getAttribute('aria-expanded'),
    ).toBe('false')

    fireEvent.pointerEnter(row)
    expect(
      screen
        .getByRole('button', { name: 'Show fewer messages' })
        .getAttribute('aria-expanded'),
    ).toBe('true')

    fireEvent.pointerLeave(row)
    expect(
      screen
        .getByRole('button', { name: 'Show 1 more message' })
        .getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('hides the reveal region from assistive tech until expanded, via aria-controls', () => {
    const group = groupOf({ id: 'n1' }, { id: 'n2' })
    render(
      <MessageNotification group={group} previewMode="full" onOpen={vi.fn()} />,
    )
    const chip = screen.getByRole('button', { name: 'Show 1 more message' })
    const controlsId = chip.getAttribute('aria-controls')
    expect(controlsId).toBeTruthy()
    const region = controlsId ? document.getElementById(controlsId) : null
    expect(region).toBeTruthy()
    expect(region?.getAttribute('aria-hidden')).toBe('true')

    fireEvent.click(chip)
    expect(region?.getAttribute('aria-hidden')).toBe('false')
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

describe('showMessageNotificationToast', () => {
  beforeEach(() => {
    resetNotificationGroups()
  })

  it('accumulates repeated messages for the same conversation into one group', () => {
    const { showToast, calls } = createFakeShowToast()

    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n1', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })
    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n2', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })

    expect(calls).toHaveLength(2)
    const group = groupFromBody(calls[1].body)
    expect(group.total).toBe(2)
    expect(group.items.map((item) => item.id)).toEqual(['n1', 'n2'])
  })

  it('keeps groups independent per conversation', () => {
    const { showToast, calls } = createFakeShowToast()

    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n1', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })
    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n2', conversationId: 'c2' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })

    expect(groupFromBody(calls[0].body).total).toBe(1)
    expect(groupFromBody(calls[1].body).total).toBe(1)
  })

  it('shows the toast pinned to the conversation, overwriting rather than stacking', () => {
    const { showToast, calls } = createFakeShowToast()

    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n1', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })

    expect(calls[0].uniqueID).toBe('c1')
    expect(calls[0].collisionBehavior).toBe('overwrite')
  })

  it('clears the group when the toast is hidden, so the next message starts fresh', () => {
    const { showToast, calls } = createFakeShowToast()

    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n1', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })
    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n2', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })
    expect(groupFromBody(calls[1].body).total).toBe(2)

    calls[1].onHide?.('manual')

    showMessageNotificationToast({
      details: buildMessageNotificationDetails({ id: 'n3', conversationId: 'c1' }),
      previewMode: 'full',
      onOpen: vi.fn(),
      showToast,
    })
    expect(groupFromBody(calls[2].body).total).toBe(1)
    expect(groupFromBody(calls[2].body).items.map((item) => item.id)).toEqual([
      'n3',
    ])
  })
})
