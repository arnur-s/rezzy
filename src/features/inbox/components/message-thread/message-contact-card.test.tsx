import type { ContactDetail } from '@/entities/contact'
import { parseSharedContacts } from '@/entities/message'
import type { SharedContact } from '@/entities/message'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactMatch } from '@/features/contacts'
import type * as ContactsApi from '@/features/contacts/api/contacts'
import type * as ContactPhonesApi from '@/features/contacts/api/contact-phones'
import type * as PhoneRegionApi from '@/features/workspaces/api/workspace-phone-region'
import { MessageContactCard } from './message-contact-card'

const api = vi.hoisted(() => ({
  matchWorkspaceContacts: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  getWorkspaceContact: vi.fn(),
  setContactPhones: vi.fn(),
  listContactPhones: vi.fn(),
  phoneRegion: vi.fn(),
  navigate: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('@/features/contacts/api/contact-matches', () => ({
  matchWorkspaceContacts: api.matchWorkspaceContacts,
}))

vi.mock('@/features/contacts/api/contact-phones', async () => {
  const actual = await vi.importActual<typeof ContactPhonesApi>(
    '@/features/contacts/api/contact-phones',
  )
  return {
    ...actual,
    listContactPhones: api.listContactPhones,
    setContactPhones: api.setContactPhones,
  }
})

vi.mock('@/features/workspaces/api/workspace-phone-region', async () => {
  const actual = await vi.importActual<typeof PhoneRegionApi>(
    '@/features/workspaces/api/workspace-phone-region',
  )
  return { ...actual, getWorkspacePhoneRegion: api.phoneRegion }
})

vi.mock('@/features/contacts/api/contacts', async () => {
  const actual = await vi.importActual<typeof ContactsApi>(
    '@/features/contacts/api/contacts',
  )
  return {
    ...actual,
    createContact: api.createContact,
    updateContact: api.updateContact,
    getWorkspaceContact: api.getWorkspaceContact,
  }
})

vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useWorkspaceMemberDirectory: () => ({ data: [] }),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => api.navigate }
})

vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => api.showToast }))

const WHATSAPP_CARD = {
  contacts: [
    {
      name: 'Dana Abisheva',
      phones: [{ phone: '+7 701 123 45 67', wa_id: '77011234567' }],
    },
  ],
}

/** One person, two numbers — a real WhatsApp card carries several. */
const TWO_NUMBER_CARD = {
  contacts: [
    {
      name: 'Dana Abisheva',
      phones: [
        { phone: '+7 701 123 45 67', wa_id: '77011234567' },
        { phone: '+7 705 994 9082', wa_id: '77059949082' },
      ],
    },
  ],
}

function sharedContact(metadata: unknown = WHATSAPP_CARD): Array<SharedContact> {
  return parseSharedContacts(metadata)
}

function contactMatch(overrides: Partial<ContactMatch> = {}): ContactMatch {
  return {
    id: 'contact-1',
    name: 'Dana Abisheva',
    phone: '+77011234567',
    email: null,
    avatar_url: null,
    status: 'new',
    match_reason: 'phone',
    ...overrides,
  }
}

function contactDetail(overrides: Partial<ContactDetail> = {}): ContactDetail {
  return {
    id: 'contact-new',
    workspace_id: 'workspace-1',
    name: 'Dana Abisheva',
    phone: '+77011234567',
    email: null,
    avatar_url: null,
    status: 'new',
    source: 'manual',
    tags: [],
    owner_id: null,
    last_seen_at: null,
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
    deleted_at: null,
    contact_channels: [],
    ...overrides,
  }
}

function renderCard(contacts = sharedContact()) {
  return renderWithQueryClient(
    <MessageContactCard
      contacts={contacts}
      isOutbound={false}
      workspaceId="workspace-1"
    />,
  )
}

describe('MessageContactCard', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function close() {
      this.open = false
    }
  })

  beforeEach(() => {
    setLocale('en', { reload: false })
    vi.clearAllMocks()
    api.matchWorkspaceContacts.mockResolvedValue([])
    api.listContactPhones.mockResolvedValue([])
    api.setContactPhones.mockResolvedValue([])
    // No workspace default region unless a test sets one.
    api.phoneRegion.mockResolvedValue(null)
    api.getWorkspaceContact.mockImplementation(
      ({ contactId }: { contactId: string }) =>
        Promise.resolve(contactDetail({ id: contactId })),
    )
  })

  it('renders the shared name and phone number', async () => {
    renderCard()

    expect(screen.getByText('Dana Abisheva')).toBeTruthy()
    expect(screen.getByText('+7 701 123 4567')).toBeTruthy()
    await screen.findByRole('button', { name: 'Create contact' })
  })

  it('offers to create the contact when nothing matches', async () => {
    renderCard()

    expect(
      await screen.findByRole('button', { name: 'Create contact' }),
    ).toBeTruthy()
    expect(api.matchWorkspaceContacts).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      lookup: {
        // Normalized digits, which is what the database compares.
        phoneDigits: ['77011234567', '87011234567'],
        emails: [],
        channelIdentities: ['whatsapp:77011234567'],
        ambiguousPhones: [],
      },
    })
  })

  it('never creates a contact, or raises a toast, just by rendering', async () => {
    renderCard()

    await screen.findByRole('button', { name: 'Create contact' })
    expect(api.createContact).not.toHaveBeenCalled()
    expect(api.showToast).not.toHaveBeenCalled()
  })

  it('opens the contact form prefilled from the shared payload', async () => {
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Create contact' }))

    const name = await screen.findByLabelText<HTMLInputElement>(/Name/)
    expect(name.value).toBe('Dana Abisheva')
    // E.164, the shape the webhooks store, so the new record matches this card.
    expect(screen.getByLabelText<HTMLInputElement>(/Phone/).value).toBe(
      '+77011234567',
    )
    // Still the user's decision: opening the form saved nothing.
    expect(api.createContact).not.toHaveBeenCalled()
  })

  it('switches to "Open contact" once the contact has been created', async () => {
    api.createContact.mockResolvedValue(contactDetail())
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Create contact' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }))

    const open = await screen.findByRole('button', { name: 'Open contact' })
    expect(api.createContact).toHaveBeenCalledTimes(1)

    fireEvent.click(open)
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith({
        to: '/workspaces/$id/contacts/$contactId',
        params: { id: 'workspace-1', contactId: 'contact-new' },
      }),
    )
  })

  it('opens the matched contact when the person is already in the CRM', async () => {
    api.matchWorkspaceContacts.mockResolvedValue([contactMatch()])
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Open contact' }))

    expect(
      screen.queryByRole('button', { name: 'Create contact' }),
    ).toBeNull()
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith({
        to: '/workspaces/$id/contacts/$contactId',
        params: { id: 'workspace-1', contactId: 'contact-1' },
      }),
    )
  })

  it('recovers when the matched contact has since been deleted', async () => {
    // The first lookup finds it; by the time the user clicks it is gone, and
    // the re-run after the invalidation finds nothing.
    api.matchWorkspaceContacts.mockResolvedValueOnce([contactMatch()])
    api.getWorkspaceContact.mockResolvedValue(null)
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Open contact' }))

    // No navigation to a not-found page: the stale answer is dropped and the
    // card offers to create instead.
    await waitFor(() =>
      expect(api.showToast).toHaveBeenCalledWith({
        body: 'That contact no longer exists',
        type: 'error',
      }),
    )
    expect(api.navigate).not.toHaveBeenCalled()
    expect(
      await screen.findByRole('button', { name: 'Create contact' }),
    ).toBeTruthy()
  })

  it('asks the user to review when several contacts could be the match', async () => {
    api.matchWorkspaceContacts.mockResolvedValue([
      contactMatch(),
      contactMatch({ id: 'contact-2', name: 'D. Abisheva' }),
    ])
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Review match' }))

    fireEvent.click(await screen.findByRole('button', { name: /D\. Abisheva/ }))
    await waitFor(() =>
      expect(api.navigate).toHaveBeenCalledWith({
        to: '/workspaces/$id/contacts/$contactId',
        params: { id: 'workspace-1', contactId: 'contact-2' },
      }),
    )
  })

  it('lets the user reject every candidate and create a new contact', async () => {
    api.matchWorkspaceContacts.mockResolvedValue([
      contactMatch(),
      contactMatch({ id: 'contact-2' }),
    ])
    renderCard()

    fireEvent.click(await screen.findByRole('button', { name: 'Review match' }))
    fireEvent.click(
      await screen.findByRole('button', { name: /None of these/ }),
    )

    expect(await screen.findByLabelText(/Name/)).toBeTruthy()
    expect(api.navigate).not.toHaveBeenCalled()
  })

  it('shows no create action while the lookup is still running', async () => {
    let resolve: (matches: Array<ContactMatch>) => void = () => {}
    api.matchWorkspaceContacts.mockReturnValue(
      new Promise<Array<ContactMatch>>((next) => {
        resolve = next
      }),
    )
    renderCard()

    // The action must not flash "Create contact" and then change its mind.
    expect(screen.queryByRole('button', { name: 'Create contact' })).toBeNull()
    const checking = screen.getByRole<HTMLButtonElement>('button', {
      name: /Checking contacts/,
    })
    expect(checking.disabled).toBe(true)

    resolve([contactMatch()])
    expect(
      await screen.findByRole('button', { name: 'Open contact' }),
    ).toBeTruthy()
  })

  it('keeps the details readable and copyable when the lookup fails', async () => {
    api.matchWorkspaceContacts.mockRejectedValue(new Error('offline'))
    renderCard()

    expect(await screen.findByText('Unable to check contacts')).toBeTruthy()
    expect(screen.getByText('Dana Abisheva')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Copy details' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create contact' })).toBeNull()
  })

  it('says it could not check a number whose country is unknown', async () => {
    renderCard(
      sharedContact({
        contacts: [{ name: 'Dana Abisheva', phone: '8 (701) 123-45-67' }],
      }),
    )

    // Claiming "Create contact" here would imply the CRM was checked and came
    // back empty. It was not checked at all.
    expect(
      await screen.findByText('Number has no country code — can’t check the CRM'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeTruthy()
    // Creating is still allowed — the user reviews the number in the form.
    expect(screen.getByRole('button', { name: 'Create contact' })).toBeTruthy()
    await waitFor(() =>
      expect(api.matchWorkspaceContacts).not.toHaveBeenCalled(),
    )
  })

  it('checks that same number once the workspace names a country', async () => {
    api.phoneRegion.mockResolvedValue('KZ')
    renderCard(
      sharedContact({
        contacts: [{ name: 'Dana Abisheva', phone: '8 (701) 123-45-67' }],
      }),
    )

    expect(
      await screen.findByRole('button', { name: 'Create contact' }),
    ).toBeTruthy()
    await waitFor(() =>
      expect(api.matchWorkspaceContacts).toHaveBeenCalledWith(
        expect.objectContaining({
          lookup: expect.objectContaining({
            phoneDigits: expect.arrayContaining(['77011234567']),
          }),
        }),
      ),
    )
  })

  it('prefills every number the card carries, not just the first', async () => {
    api.createContact.mockResolvedValue(contactDetail())
    renderCard(
      sharedContact({
        contacts: [
          {
            name: 'Dana Abisheva',
            phones: [{ phone: '+7 701 123 45 67' }, { phone: '+7 701 999 88 77' }],
          },
        ],
      }),
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Create contact' }))

    expect(
      (await screen.findByLabelText<HTMLInputElement>(/^Phone ·/)).value,
    ).toBe('+77011234567')
    expect(screen.getByLabelText<HTMLInputElement>(/^Phone 2 ·/).value).toBe(
      '+77019998877',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Both numbers are persisted, not just the primary.
    await waitFor(() =>
      expect(api.setContactPhones).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        contactId: 'contact-new',
        phones: ['+77011234567', '+77019998877'],
      }),
    )
  })

  it('offers to add a number the matched contact does not have', async () => {
    // The case the CRM used to lose: the card names Dana by two numbers, the
    // contact it matches knows only the first, and opening it would show a
    // record the card can see is incomplete.
    api.matchWorkspaceContacts.mockResolvedValue([contactMatch()])
    api.listContactPhones.mockResolvedValue([
      { id: 'phone-1', phone: '+77011234567', digits: '77011234567', position: 0 },
    ])
    api.updateContact.mockResolvedValue(contactDetail({ id: 'contact-1' }))

    renderCard(sharedContact(TWO_NUMBER_CARD))

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add to contact' }),
    )

    // The contact's own number first, the card's addition after it — the form
    // shows exactly what is about to be saved, and to whom.
    expect(
      (await screen.findByLabelText<HTMLInputElement>(/^Phone ·/)).value,
    ).toBe('+77011234567')
    expect(screen.getByLabelText<HTMLInputElement>(/^Phone 2 ·/).value).toBe(
      '+77059949082',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(api.setContactPhones).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        contactId: 'contact-1',
        phones: ['+77011234567', '+77059949082'],
      }),
    )
  })

  it('says nothing when the contact already has every number on the card', async () => {
    api.matchWorkspaceContacts.mockResolvedValue([contactMatch()])
    api.listContactPhones.mockResolvedValue([
      { id: 'phone-1', phone: '+77011234567', digits: '77011234567', position: 0 },
      // The same second number, spelled the way somebody typed it. Identity is
      // compared by number, not by string, so this is not a missing one.
      {
        id: 'phone-2',
        phone: '+7 705 994 90 82',
        digits: '77059949082',
        position: 1,
      },
    ])

    renderCard(sharedContact(TWO_NUMBER_CARD))

    await screen.findByRole('button', { name: 'Open contact' })
    expect(screen.queryByRole('button', { name: 'Add to contact' })).toBeNull()
  })

  it('falls back to copying when the card identifies nobody', async () => {
    renderCard(sharedContact({ contacts: [{ name: 'Ivan' }] }))

    expect(screen.getByText('Ivan')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy details' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Create contact' })).toBeNull()
    // Nothing to look up means nothing is looked up.
    await waitFor(() =>
      expect(api.matchWorkspaceContacts).not.toHaveBeenCalled(),
    )
  })
})
