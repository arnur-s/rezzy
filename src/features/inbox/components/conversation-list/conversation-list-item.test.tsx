import type { ConversationWithRelations } from '@/entities/conversation'
import { ListBox } from '@heroui/react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConversationListItem } from './conversation-list-item'

vi.mock('@/entities/channel', async () => {
  const actual = await vi.importActual('@/entities/channel')
  return {
    ...actual,
    PlatformIcon: () => <span data-testid="platform-icon" />,
  }
})

function conversation(overrides: {
  id?: string
  unread_count?: number
  contactName?: string
}): ConversationWithRelations {
  const id = overrides.id ?? 'conv-1'
  return {
    id,
    workspace_id: 'w',
    channel_id: 'c',
    contact_id: 'p',
    assigned_to: null,
    status: 'open',
    unread_count: overrides.unread_count ?? 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    created_at: '2020-01-01',
    updated_at: '2020-01-01',
    channel: { id: 'c', type: 'telegram', name: null },
    contact: {
      id: 'p',
      name: overrides.contactName ?? 'Test Contact',
      phone: null,
      avatar_url: null,
      status: 'new',
    },
    assigned_profile: null,
  }
}

function renderInList(row: ConversationWithRelations, isActive: boolean) {
  return render(
    <ListBox
      aria-label="Conversations"
      selectionMode="single"
      selectedKeys={isActive ? new Set([row.id]) : new Set()}
      onSelectionChange={vi.fn()}
    >
      <ListBox.Item
        id={row.id}
        textValue={row.contact.name?.trim() || '—'}
        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5"
      >
        <ConversationListItem conversation={row} isActive={isActive} />
      </ListBox.Item>
    </ListBox>,
  )
}

describe('ConversationListItem unread display', () => {
  it('hides unread badge and non-unread typography when active even if unread_count > 0', () => {
    const row = conversation({ unread_count: 4 })
    renderInList(row, true)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    expect(within(option).queryByText('4', { exact: true })).toBeNull()

    const title = within(option).getByText('Test Contact')
    expect(title.className).toContain('font-medium')
    expect(title.className).not.toContain('font-semibold')
  })

  it('shows unread badge and emphasis when inactive and unread_count > 0', () => {
    const row = conversation({ unread_count: 4 })
    renderInList(row, false)

    const option = screen.getByRole('option', { name: /Test Contact/i })
    expect(within(option).getByText('4', { exact: true })).toBeTruthy()

    const title = within(option).getByText('Test Contact')
    expect(title.className).toContain('font-semibold')
  })
})
