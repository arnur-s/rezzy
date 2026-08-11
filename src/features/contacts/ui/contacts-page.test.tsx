import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactListPatch } from '../model/contact-list-params'
import { EMPTY_CONTACT_LIST_PARAMS } from '../model/contact-list-params'
import { ContactsPage } from './contacts-page'

const isAdmin = vi.hoisted(() => ({ value: false }))

vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useIsWorkspaceAdmin: () => ({ isAdmin: isAdmin.value, isLoaded: true }),
  useWorkspaceMemberDirectory: () => ({ data: [] }),
}))

const EMPTY_QUERY = {
  data: { items: [], totalCount: 0 },
  isPending: false,
  isError: false,
  isSuccess: true,
  isRefetching: false,
  refetch: vi.fn(),
}

vi.mock('../hooks/use-contacts', () => ({
  useContactList: () => EMPTY_QUERY,
  useArchivedContacts: () => EMPTY_QUERY,
  useRestoreContact: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children }: { children: React.ReactNode }) => (
      <a href="#contact">{children}</a>
    ),
  }
})

function renderPage(
  overrides: {
    isArchived?: boolean
    isDuplicates?: boolean
  } = {},
) {
  const onParamsChange = vi.fn<(patch: ContactListPatch) => void>()
  renderWithQueryClient(
    <ContactsPage
      workspaceId="ws-1"
      params={EMPTY_CONTACT_LIST_PARAMS}
      isArchived={overrides.isArchived ?? false}
      isDuplicates={overrides.isDuplicates ?? false}
      onParamsChange={onParamsChange}
      onCreate={vi.fn()}
    />,
  )
  return onParamsChange
}

describe('ContactsPage filter row', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    isAdmin.value = false
    vi.clearAllMocks()
  })

  it('shows the Duplicates chip to a plain member, unlike Archived', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Duplicates' })).not.toBeNull()
    // Archived stays owner/admin only, matching the RPC behind it.
    expect(screen.queryByRole('button', { name: 'Archived' })).toBeNull()
  })

  it('shows both chips to an admin', () => {
    isAdmin.value = true
    renderPage()

    expect(screen.getByRole('button', { name: 'Duplicates' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Archived' })).not.toBeNull()
  })

  it('asks for the duplicates view and clears archived when the chip is clicked', () => {
    const onParamsChange = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Duplicates' }))

    expect(onParamsChange).toHaveBeenCalledWith({
      duplicates: true,
      archived: false,
      page: 1,
    })
  })

  it('asks for the archived view and clears duplicates when that chip is clicked', () => {
    isAdmin.value = true
    const onParamsChange = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))

    expect(onParamsChange).toHaveBeenCalledWith({
      archived: true,
      duplicates: false,
      page: 1,
    })
  })

  it('treats duplicates and archived as mutually exclusive when a stale URL carries both', () => {
    isAdmin.value = true
    renderPage({ isArchived: true, isDuplicates: true })

    // Duplicates wins: its notice shows, and the status/owner/sort controls
    // (archived-only-hidden, duplicates-only-hidden) stay hidden either way.
    expect(
      screen.getByText(
        'Contacts sharing a phone number, channel or email. Name matches are not considered.',
      ),
    ).not.toBeNull()
    expect(
      screen.queryByText('The archive is visible to owners and admins only.'),
    ).toBeNull()
  })
})
