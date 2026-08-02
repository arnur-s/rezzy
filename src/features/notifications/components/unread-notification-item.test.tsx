import type { ConversationWithRelations } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { setLocale } from '@/paraglide/runtime'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnreadNotificationItem } from './unread-notification-item'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

function conversationFixture(
  id: string,
  overrides: Partial<ConversationWithRelations> = {},
): ConversationWithRelations {
  return {
    id,
    workspace_id: 'w1',
    channel_id: 'ch1',
    contact_id: 'ct1',
    assigned_to: null,
    status: 'open',
    unread_count: 3,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'See you tomorrow',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-15T10:00:00Z',
    channel: { id: 'ch1', type: 'telegram', name: 'Support' },
    contact: {
      id: 'ct1',
      name: 'Alice Johnson',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    ...overrides,
  }
}

function renderItem(
  conversation: ConversationWithRelations,
  workspaceName: string | null = null,
) {
  const onSelect = vi.fn()
  render(
    <ul>
      <UnreadNotificationItem
        conversation={conversation}
        workspaceName={workspaceName}
        onSelect={onSelect}
      />
    </ul>,
  )
  return { onSelect }
}

describe('UnreadNotificationItem', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('renders contact name, preview, platform icon, and the unread chip', () => {
    renderItem(conversationFixture('c1'))
    expect(screen.getByText('Alice Johnson')).toBeTruthy()
    expect(screen.getByText('See you tomorrow')).toBeTruthy()
    expect(screen.getByTestId('platform-icon')).toBeTruthy()
    // Read from the catalogue rather than pinned as a literal: the label is
    // plural-sensitive, so a hardcoded string here would assert only the arm
    // this fixture happens to hit.
    expect(
      screen.getByLabelText(m.inbox_unread_aria_label({ count: 3 })),
    ).toBeTruthy()
  })

  it('falls back safely when the contact name and preview are missing', () => {
    renderItem(
      conversationFixture('c1', {
        contact: {
          id: 'ct1',
          name: null,
          phone: null,
          avatar_url: null,
          status: 'new',
        },
        last_message_preview: null,
      }),
    )
    // Name fallback and avatar initials both render the em dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /Open conversation with —/ }),
    ).toBeTruthy()
  })

  it('reports the conversation when the row is clicked', () => {
    const conversation = conversationFixture('c42')
    const { onSelect } = renderItem(conversation)
    fireEvent.click(
      screen.getByRole('button', {
        name: /Open conversation with Alice Johnson/,
      }),
    )
    expect(onSelect).toHaveBeenCalledWith(conversation)
  })

  it('shows the workspace label only when one is provided', () => {
    renderItem(conversationFixture('c1'))
    expect(screen.queryByText('Acme Support')).toBeNull()

    cleanup()
    renderItem(conversationFixture('c1'), 'Acme Support')
    expect(screen.getByText('Acme Support')).toBeTruthy()
  })
})
