import type { ContactListItem } from '@/entities/contact'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactListPage } from '../api/contacts'
import type { MergeChildCounts } from '../api/contact-merges'
import { EMPTY_CONTACT_LIST_PARAMS } from '../model/contact-list-params'
import type { ListQueryState } from '../model/list-query-state'
import { DirectoryView } from './directory-view'

const merge = vi.fn()

vi.mock('../hooks/use-contact-merges', () => ({
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

// `Link` needs a real router context this test does not set up; the app's own
// tests (e.g. attention-list.test.tsx) stand in an anchor for it the same way.
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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

function contact(id: string, overrides: Partial<ContactListItem> = {}): ContactListItem {
  return {
    id,
    workspace_id: 'ws-1',
    name: `Contact ${id}`,
    display_name: `Contact ${id}`,
    phone: null,
    email: null,
    avatar_url: null,
    status: 'new',
    source: null,
    tags: [],
    owner_id: null,
    last_seen_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    channel_types: [],
    total_count: 3,
    ...overrides,
  }
}

function queryState(
  items: Array<ContactListItem>,
  overrides: Partial<ListQueryState<ContactListPage>> = {},
): ListQueryState<ContactListPage> {
  return {
    data: { items, totalCount: items.length },
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderDirectory(
  items: Array<ContactListItem>,
  overrides: {
    canMerge?: boolean
    query?: Partial<ListQueryState<ContactListPage>>
  } = {},
) {
  return renderWithQueryClient(
    <DirectoryView
      workspaceId="ws-1"
      query={queryState(items, overrides.query)}
      params={EMPTY_CONTACT_LIST_PARAMS}
      ownerNameById={new Map()}
      canMerge={overrides.canMerge ?? true}
      onParamsChange={vi.fn()}
      onClearFilters={vi.fn()}
      onCreate={vi.fn()}
    />,
  )
}

function checkboxFor(name: string) {
  return screen.getByRole<HTMLInputElement>('checkbox', {
    name: new RegExp(name),
  })
}

describe('DirectoryView selection', () => {
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

  it('renders no selection checkboxes for a member who cannot merge', () => {
    renderDirectory([contact('a'), contact('b')], { canMerge: false })

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    // Nothing to select means nothing can ever open the selection bar.
    expect(screen.queryByText(/selected/)).toBeNull()
  })

  it('picking a third contact replaces the oldest pick rather than blocking it', () => {
    renderDirectory([contact('a'), contact('b'), contact('c')])

    fireEvent.click(checkboxFor('Contact a'))
    fireEvent.click(checkboxFor('Contact b'))
    fireEvent.click(checkboxFor('Contact c'))

    // The most plausible wrong implementations are "ignore the third click"
    // (a stays checked) or "clear everything on the third click" (nothing
    // stays checked). Only "drop the oldest, keep the two most recent" passes
    // all three assertions below.
    expect(checkboxFor('Contact a').checked).toBe(false)
    expect(checkboxFor('Contact b').checked).toBe(true)
    expect(checkboxFor('Contact c').checked).toBe(true)
    expect(screen.getByText('2 contacts selected')).not.toBeNull()
  })

  it('keeps Merge disabled and shows the hint below exactly two selections', () => {
    renderDirectory([contact('a'), contact('b')])

    fireEvent.click(checkboxFor('Contact a'))

    expect(screen.getByText('1 contact selected')).not.toBeNull()
    expect(
      screen.getByText('Select exactly two contacts to merge them.'),
    ).not.toBeNull()
    const mergeButton = screen.getByRole('button', { name: 'Merge' })
    expect(mergeButton.hasAttribute('disabled')).toBe(true)

    fireEvent.click(checkboxFor('Contact b'))

    expect(screen.queryByText(/Select exactly two/)).toBeNull()
    expect(mergeButton.hasAttribute('disabled')).toBe(false)
  })

  it('opens the merge dialog for the two selected contacts', async () => {
    renderDirectory([contact('a'), contact('b'), contact('c')])

    fireEvent.click(checkboxFor('Contact a'))
    fireEvent.click(checkboxFor('Contact b'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Merge contacts')).not.toBeNull()
    // Both picked contacts are offered as the survivor.
    const survivorGroup = within(dialog).getByRole('radiogroup', {
      name: /Contact to keep/,
    })
    expect(within(survivorGroup).getAllByRole('radio')).toHaveLength(2)
  })

  it('clears a stale selection when the page changes under it', () => {
    const { rerender } = renderDirectory([contact('a'), contact('b')])

    fireEvent.click(checkboxFor('Contact a'))
    fireEvent.click(checkboxFor('Contact b'))
    expect(screen.getByText('2 contacts selected')).not.toBeNull()

    rerender(
      <DirectoryView
        workspaceId="ws-1"
        query={queryState([contact('c'), contact('d')])}
        params={{ ...EMPTY_CONTACT_LIST_PARAMS, page: 2 }}
        ownerNameById={new Map()}
        canMerge
        onParamsChange={vi.fn()}
        onClearFilters={vi.fn()}
        onCreate={vi.fn()}
      />,
    )

    // Old ids are gone from the row set; nothing stale should linger in the
    // toolbar, unreachable by any checkbox now on screen.
    expect(screen.queryByText(/selected/)).toBeNull()
  })

  it('keeps the selection across a re-render carrying the same logical params', () => {
    // The route builds `params` as a fresh object literal on every render of
    // its own component (see `contacts/index.tsx`), so an ancestor re-render
    // unrelated to the list — opening the "Add contact" dialog, for one —
    // produces a new `params` reference with identical field values. A
    // selection-clearing effect keyed on that object's identity would wipe
    // the pick here even though nothing about the row set actually changed;
    // one keyed on the primitive fields must not.
    const { rerender } = renderDirectory([contact('a'), contact('b')])

    fireEvent.click(checkboxFor('Contact a'))
    fireEvent.click(checkboxFor('Contact b'))
    expect(screen.getByText('2 contacts selected')).not.toBeNull()

    rerender(
      <DirectoryView
        workspaceId="ws-1"
        query={queryState([contact('a'), contact('b')])}
        params={{ ...EMPTY_CONTACT_LIST_PARAMS }}
        ownerNameById={new Map()}
        canMerge
        onParamsChange={vi.fn()}
        onClearFilters={vi.fn()}
        onCreate={vi.fn()}
      />,
    )

    expect(screen.getByText('2 contacts selected')).not.toBeNull()
    expect(checkboxFor('Contact a').checked).toBe(true)
    expect(checkboxFor('Contact b').checked).toBe(true)
  })

  it('clears the selection once a merge succeeds', async () => {
    renderDirectory([contact('a'), contact('b')])

    fireEvent.click(checkboxFor('Contact a'))
    fireEvent.click(checkboxFor('Contact b'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))
    // The selection bar's own "Merge" button is still on screen behind the
    // dialog at this point, so the dialog's confirm button has to be scoped.
    fireEvent.click(within(dialog).getByRole('button', { name: /^Merge$/ }))

    await waitFor(() => expect(merge).toHaveBeenCalledTimes(1))
    const onSuccess = merge.mock.calls[0][1].onSuccess as () => void
    onSuccess()

    await waitFor(() => {
      expect(screen.queryByText(/selected/)).toBeNull()
    })
  })
})
