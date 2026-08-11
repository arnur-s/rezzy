import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DuplicateContact,
  DuplicateGroup,
  DuplicateGroupPage,
  MergeChildCounts,
} from '../api/contact-merges'
import { DuplicatesView } from './duplicates-view'

const merge = vi.hoisted(() => vi.fn())

/** The slice of `useDuplicateContactGroups`'s result the view actually reads. */
type GroupsQueryResult = {
  data: DuplicateGroupPage | undefined
  isPending: boolean
  isError: boolean
  isRefetching: boolean
  refetch: () => unknown
}

const groupsQuery = vi.hoisted(() => vi.fn<() => GroupsQueryResult>())

vi.mock('../hooks/use-contact-merges', () => ({
  useDuplicateContactGroups: () => groupsQuery(),
  useMergeContacts: () => ({ mutate: merge, isPending: false }),
  useContactMergeChildren: (): {
    data: MergeChildCounts | undefined
    isPending: boolean
    isError: boolean
  } => ({
    data: {
      conversation_count: 0,
      note_count: 0,
      phone_count: 0,
      channel_count: 0,
    },
    isPending: false,
    isError: false,
  }),
}))

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => vi.fn(),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({
      children,
      params,
      className,
    }: {
      children: React.ReactNode
      params?: Record<string, string>
      className?: string
    }) => (
      <a href="#contact" className={className} data-params={JSON.stringify(params)}>
        {children}
      </a>
    ),
  }
})

function duplicateContact(
  id: string,
  overrides: Partial<DuplicateContact> = {},
): DuplicateContact {
  return {
    id,
    display_name: `Contact ${id}`,
    name: `Contact ${id}`,
    phone: '+15550001',
    email: null,
    avatar_url: null,
    status: 'new',
    source: null,
    owner_id: null,
    tags: [],
    last_seen_at: null,
    conversation_count: 0,
    ...overrides,
  }
}

function group(overrides: Partial<DuplicateGroup> = {}): DuplicateGroup {
  const contacts = overrides.contacts ?? [
    duplicateContact('a'),
    duplicateContact('b'),
  ]
  return {
    group_key: 'phone:+15550001',
    match_reason: 'phone',
    contacts,
    contact_count: contacts.length,
    total_count: 1,
    ...overrides,
  }
}

function setGroupsResult(overrides: Partial<GroupsQueryResult> = {}) {
  groupsQuery.mockReturnValue({
    data: { items: [], totalCount: 0 },
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: vi.fn(),
    ...overrides,
  })
}

function renderDuplicates(canMerge = true) {
  return renderWithQueryClient(
    <DuplicatesView
      workspaceId="ws-1"
      page={1}
      onPageChange={vi.fn()}
      enabled
      canMerge={canMerge}
    />,
  )
}

describe('DuplicatesView', () => {
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
  })

  it('renders the empty state when there are no duplicate groups', () => {
    setGroupsResult({ data: { items: [], totalCount: 0 } })
    renderDuplicates()

    expect(screen.getByText('No duplicates')).not.toBeNull()
  })

  it('renders the error state with a retry action when the scan fails', () => {
    const refetch = vi.fn()
    setGroupsResult({ data: undefined, isError: true, refetch })
    renderDuplicates()

    expect(screen.getByText('Could not load duplicates')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('renders the skeleton while pending, not the empty state', () => {
    setGroupsResult({ data: undefined, isPending: true })
    renderDuplicates()

    expect(screen.queryByText('No duplicates')).toBeNull()
    expect(screen.queryByText('Could not load duplicates')).toBeNull()
  })

  it('hides the Merge action for a member who cannot merge', () => {
    setGroupsResult({ data: { items: [group()], totalCount: 1 } })
    renderDuplicates(false)

    expect(screen.getByText('Same phone number')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Merge' })).toBeNull()
  })

  it('disables Merge on a group whose member count is not exactly two', () => {
    setGroupsResult({
      data: {
        items: [
          group({
            contacts: [
              duplicateContact('a'),
              duplicateContact('b'),
              duplicateContact('c'),
            ],
          }),
        ],
        totalCount: 1,
      },
    })
    renderDuplicates(true)

    const mergeButton = screen.getByRole('button', { name: 'Merge' })
    expect(mergeButton.hasAttribute('disabled')).toBe(true)

    fireEvent.click(mergeButton)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the merge dialog for a two-contact group', async () => {
    setGroupsResult({ data: { items: [group()], totalCount: 1 } })
    renderDuplicates(true)

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Merge contacts')).not.toBeNull()
  })

  it('shows pagination only once the count exceeds one page', () => {
    setGroupsResult({ data: { items: [group()], totalCount: 1 } })
    renderDuplicates()

    expect(screen.getByText('Same phone number')).not.toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
