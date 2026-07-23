import { setLocale } from '@/paraglide/runtime'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { MessageNotificationDetails } from '../model/types'
import { MessageNotification } from './message-notification'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

const now = new Date().toISOString()

function buildDetails(
  overrides: Partial<MessageNotificationDetails> = {},
): MessageNotificationDetails {
  return {
    id: 'n1',
    workspaceId: 'w1',
    workspaceName: 'Acme Support',
    conversationId: 'c1',
    messageId: 'm1',
    createdAt: now,
    message: {
      id: 'm1',
      type: 'text',
      content: 'Hello, I still need help with my order',
      metadata: {},
      media_filename: null,
      media_mime_type: null,
      created_at: now,
      direction: 'inbound',
    },
    conversation: {
      id: 'c1',
      workspace_id: 'w1',
      channel_id: 'ch1',
      contact_id: 'ct1',
      assigned_to: null,
      status: 'open',
      unread_count: 0,
      last_message_at: now,
      last_message_preview: null,
      snoozed_until: null,
      external_thread_id: null,
      last_inbound_at: null,
      created_at: now,
      updated_at: now,
      channel: { id: 'ch1', type: 'telegram', name: 'Support' },
      contact: {
        id: 'ct1',
        name: 'Maria',
        phone: null,
        avatar_url: null,
        status: 'active',
      },
      assigned_profile: null,
    },
    ...overrides,
  }
}

describe('MessageNotification', () => {
  beforeAll(() => {
    setLocale('en')
  })

  it('renders contact name, workspace label, preview and the open action', () => {
    render(
      <MessageNotification
        details={buildDetails()}
        previewMode="full"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.getByText('Maria')).toBeTruthy()
    expect(screen.getByText('Acme Support')).toBeTruthy()
    expect(
      screen.getByText(/I still need help with my order/i),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open thread' })).toBeTruthy()
  })

  it('calls onOpen when the open-thread action is pressed', () => {
    const onOpen = vi.fn()
    render(
      <MessageNotification
        details={buildDetails()}
        previewMode="full"
        onOpen={onOpen}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open thread' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('expands to the full message when the preview is truncated', () => {
    // The preview truncates at ~140 chars, so keep the marker well past that.
    const longMessage = `${'A'.repeat(200)} UNIQUE-TAIL ${'B'.repeat(50)}`
    render(
      <MessageNotification
        details={buildDetails({
          message: {
            id: 'm1',
            type: 'text',
            content: longMessage,
            metadata: {},
            media_filename: null,
            media_mime_type: null,
            created_at: now,
            direction: 'inbound',
          },
        })}
        previewMode="full"
        onOpen={vi.fn()}
      />,
    )
    // The tail is hidden in the truncated preview.
    expect(screen.queryByText(/UNIQUE-TAIL/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }))
    expect(screen.getByText(/UNIQUE-TAIL/)).toBeTruthy()
  })

  it('hides sender and content in hidden preview mode', () => {
    render(
      <MessageNotification
        details={buildDetails()}
        previewMode="hidden"
        onOpen={vi.fn()}
      />,
    )
    expect(screen.queryByText('Maria')).toBeNull()
    expect(
      screen.queryByText(/I still need help with my order/i),
    ).toBeNull()
    expect(screen.getByText('New message')).toBeTruthy()
  })
})
