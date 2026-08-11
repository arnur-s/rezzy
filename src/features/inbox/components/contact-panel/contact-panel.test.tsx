import type { ContactWithChannels } from '@/entities/contact'
import type { ConversationWithRelations } from '@/entities/conversation'
import { setLocale } from '@/paraglide/runtime'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactPanel } from './contact-panel'

const hoisted = vi.hoisted(() => ({
  contactNotesSection: vi.fn(
    (_props: { workspaceId: string; contactId: string }) => null,
  ),
  useContact: vi.fn(),
  useContactPhones: vi.fn(),
  useWorkspaceMemberLookup: vi.fn(),
}))

vi.mock('../../hooks/use-contact', () => ({ useContact: hoisted.useContact }))

vi.mock('@/features/contacts/hooks/use-contacts', () => ({
  useContactPhones: hoisted.useContactPhones,
}))

vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useWorkspaceMemberLookup: hoisted.useWorkspaceMemberLookup,
}))

vi.mock('@/features/contact-notes', () => ({
  ContactNotesSection: (props: { workspaceId: string; contactId: string }) =>
    hoisted.contactNotesSection(props),
}))

// Owns its own query and mutation; this file is about panel composition.
vi.mock('./contact-panel-status-select', () => ({
  ContactPanelStatusSelect: () => null,
}))

const CONVERSATION_AVATAR = 'https://cdn.example.com/from-conversation.png'
const CONTACT_AVATAR = 'https://cdn.example.com/from-contact.png'

function conversation(avatarUrl: string | null): ConversationWithRelations {
  return {
    id: 'conv-1',
    workspace_id: 'workspace-1',
    channel_id: 'channel-1',
    contact_id: 'contact-1',
    assigned_to: null,
    status: 'open',
    unread_count: 0,
    last_message_at: '2026-05-15T10:00:00Z',
    last_message_preview: 'Hi there',
    snoozed_until: null,
    external_thread_id: null,
    last_inbound_at: null,
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-01T10:00:00Z',
    deleted_at: null,
    channel: { id: 'channel-1', type: 'telegram', name: null },
    contact: {
      id: 'contact-1',
      name: 'Jane Doe',
      phone: null,
      avatar_url: avatarUrl,
      status: 'new',
    },
  }
}

function contact(
  overrides: Partial<ContactWithChannels> = {},
): ContactWithChannels {
  return {
    id: 'contact-1',
    workspace_id: 'workspace-1',
    name: 'Jane Doe',
    email: null,
    phone: null,
    avatar_url: null,
    status: 'new',
    owner_id: null,
    last_seen_at: null,
    source: null,
    tags: [],
    created_at: '2026-05-01T10:00:00Z',
    updated_at: '2026-05-02T10:00:00Z',
    deleted_at: null,
    merged_into_id: null,
    merged_at: null,
    merged_by: null,
    contact_channels: [],
    ...overrides,
  }
}

function renderPanel({
  conversationAvatar = null,
  loaded,
  phones = [],
  members = [],
}: {
  conversationAvatar?: string | null
  /** `undefined` leaves the contact query pending. */
  loaded?: ContactWithChannels
  phones?: Array<string>
  members?: Array<{ userId: string; fullName: string }>
}) {
  hoisted.useContact.mockReturnValue({
    data: loaded,
    isPending: loaded === undefined,
    isError: false,
    isRefetching: false,
    refetch: vi.fn(),
  })
  hoisted.useContactPhones.mockReturnValue({
    data: phones.map((phone, index) => ({
      id: `phone-${index}`,
      phone,
      digits: phone.replace(/\D/g, ''),
      position: index,
    })),
  })
  hoisted.useWorkspaceMemberLookup.mockReturnValue({
    lookup: new Map(members.map((member) => [member.userId, member])),
    isLoaded: true,
  })

  return render(
    <ContactPanel
      workspaceId="workspace-1"
      conversation={conversation(conversationAvatar)}
      onClose={() => {}}
    />,
  )
}

/**
 * The panel has two sources for the picture and they arrive at different times:
 * the conversation row is already in hand, the contact query lands later. It
 * has to show something immediately and then prefer the fresher value, in the
 * same order it already resolves the name.
 */
describe('ContactPanel avatar', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    vi.clearAllMocks()
  })

  it('shows the conversation picture before the contact query lands', () => {
    renderPanel({ conversationAvatar: CONVERSATION_AVATAR })

    expect(
      document.querySelector(`img[src="${CONVERSATION_AVATAR}"]`),
    ).not.toBeNull()
  })

  it('prefers the freshly loaded contact picture once it arrives', () => {
    renderPanel({
      conversationAvatar: CONVERSATION_AVATAR,
      loaded: contact({ avatar_url: CONTACT_AVATAR }),
    })

    expect(document.querySelector(`img[src="${CONTACT_AVATAR}"]`)).not.toBeNull()
    expect(
      document.querySelector(`img[src="${CONVERSATION_AVATAR}"]`),
    ).toBeNull()
  })

  it('falls back to initials when neither source has one', () => {
    renderPanel({ conversationAvatar: null, loaded: contact() })

    expect(document.querySelector('img')).toBeNull()
  })

  it('scopes Contact Notes to the active workspace and loaded contact', () => {
    renderPanel({ loaded: contact() })

    expect(hoisted.contactNotesSection).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contactId: 'contact-1',
    })
  })
})

/**
 * The panel is the only place an agent sees the contact record without leaving
 * the thread, so what it omits is effectively invisible. These pin the fields
 * that used to be missing — a second phone number, the email, the source, the
 * owner, the tags, the dates — and pin that the record's plumbing stays out.
 */
describe('ContactPanel contact record', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    vi.clearAllMocks()
  })

  it('lists every stored phone number, not just the primary', () => {
    renderPanel({
      loaded: contact({ phone: '+7 700 000 00 01' }),
      phones: ['+7 700 000 00 01', '+7 700 000 00 02'],
    })

    expect(screen.getByText('+7 700 000 00 01')).toBeTruthy()
    expect(screen.getByText('+7 700 000 00 02')).toBeTruthy()
  })

  it('falls back to the primary number while the phone set is unavailable', () => {
    renderPanel({ loaded: contact({ phone: '+7 700 000 00 01' }), phones: [] })

    expect(screen.getByText('+7 700 000 00 01')).toBeTruthy()
  })

  it('shows email, source, tags and the stored dates', () => {
    renderPanel({
      loaded: contact({
        email: 'jane@example.com',
        source: 'telegram',
        tags: ['vip', 'renewal'],
        last_seen_at: '2026-05-10T10:00:00Z',
      }),
    })

    expect(screen.getByText('jane@example.com')).toBeTruthy()
    expect(screen.getByText('vip')).toBeTruthy()
    expect(screen.getByText('renewal')).toBeTruthy()
    expect(screen.getByText('Source')).toBeTruthy()
    expect(screen.getByText('Added')).toBeTruthy()
    expect(screen.getByText('Updated')).toBeTruthy()
    expect(screen.getByText('Last activity')).toBeTruthy()
  })

  it('resolves the owner id to a teammate, and says so when there is none', () => {
    renderPanel({
      loaded: contact({ owner_id: 'user-9' }),
      members: [{ userId: 'user-9', fullName: 'Augusta King' }],
    })

    expect(screen.getByText('Augusta King')).toBeTruthy()
  })

  it('reports an unowned contact as unassigned', () => {
    renderPanel({ loaded: contact() })

    expect(screen.getByText('Unassigned')).toBeTruthy()
  })

  it('names the external handle beside the channel it belongs to', () => {
    renderPanel({
      loaded: contact({
        contact_channels: [
          {
            id: 'cc-1',
            channel_type: 'telegram',
            external_name: '@janedoe',
          },
        ],
      }),
    })

    // One badge carries both, so the handle is matched inside its channel.
    expect(screen.getByText(/Telegram · @janedoe/)).toBeTruthy()
  })

  it('keeps record plumbing out of the panel', () => {
    const { container } = renderPanel({
      loaded: contact({ deleted_at: null }),
    })

    // The row id and its workspace identify the record to the database, not
    // the person to the agent.
    expect(container.textContent).not.toContain('contact-1')
    expect(container.textContent).not.toContain('workspace-1')
  })
})
