import type { WorkspaceMember } from '@/entities/workspace'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MergeChildCounts } from '../api/contact-merges'
import type { MergeCandidate } from '../model/merge-candidate'
import { MergeContactsDialog } from './merge-contacts-dialog'

/** The slice of `useQuery`'s result the component actually reads. */
type ChildrenQueryResult = {
  data: MergeChildCounts | undefined
  isPending: boolean
  isError: boolean
}

const merge = vi.fn()
const childrenQuery = vi.fn<() => ChildrenQueryResult>()
let workspaceMembers: Array<WorkspaceMember> = []

vi.mock('../hooks/use-contact-merges', () => ({
  useMergeContacts: () => ({ mutate: merge, isPending: false }),
  useContactMergeChildren: () => childrenQuery(),
}))

vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useWorkspaceMemberDirectory: () => ({ data: workspaceMembers }),
}))

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => vi.fn(),
}))

function member(patch: Partial<WorkspaceMember>): WorkspaceMember {
  return {
    userId: 'member-1',
    role: 'member',
    fullName: 'Member One',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    joinedAt: '2026-01-01T00:00:00Z',
    ...patch,
  }
}

function candidate(patch: Partial<MergeCandidate>): MergeCandidate {
  return {
    id: 'a',
    displayName: 'A',
    name: 'A',
    phone: null,
    email: null,
    avatarUrl: null,
    status: 'new',
    source: null,
    ownerId: null,
    tags: [],
    lastSeenAt: null,
    conversationCount: 0,
    ...patch,
  }
}

const LOADED_CHILDREN: ChildrenQueryResult = {
  data: {
    conversation_count: 2,
    note_count: 1,
    phone_count: 3,
    channel_count: 1,
  },
  isPending: false,
  isError: false,
}

function renderDialog(
  pair: [MergeCandidate, MergeCandidate],
  overrides: {
    onMerged?: () => void
    onOpenChange?: (open: boolean) => void
    children?: ChildrenQueryResult
  } = {},
) {
  // Only supplies a default when the test hasn't already configured the
  // counts query itself -- otherwise this would stomp the pending/error
  // mocks a test sets up before calling renderDialog.
  childrenQuery.mockReturnValue(overrides.children ?? LOADED_CHILDREN)

  return renderWithQueryClient(
    <MergeContactsDialog
      workspaceId="ws-1"
      contacts={pair}
      onOpenChange={overrides.onOpenChange ?? (() => {})}
      onMerged={overrides.onMerged ?? (() => {})}
    />,
  )
}

function continueButton() {
  return screen.getByRole('button', { name: /Continue/ })
}

describe('MergeContactsDialog', () => {
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
    workspaceMembers = []
  })

  it('offers a choice only for fields that actually disagree', () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван', email: 'x@y.ru' }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan', email: null }),
    ])

    // name differs on both sides -> a choice.
    expect(screen.getByRole('radiogroup', { name: /Name/ })).not.toBeNull()
    // email exists on one side only -> filled silently, no control.
    expect(screen.queryByRole('radiogroup', { name: /Email/ })).toBeNull()
  })

  it('pre-selects the survivor carrying more history', () => {
    renderDialog([
      candidate({ id: 'a', displayName: 'A', conversationCount: 1 }),
      candidate({ id: 'b', displayName: 'B', conversationCount: 5 }),
    ])

    const survivorGroup = screen.getByRole('radiogroup', {
      name: /Contact to keep/,
    })
    const bRadio = within(survivorGroup).getByRole<HTMLInputElement>('radio', {
      name: 'B',
    })
    expect(bRadio.checked).toBe(true)
  })

  it('does not commit from the first step', () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван' }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan' }),
    ])

    fireEvent.click(continueButton())
    expect(merge).not.toHaveBeenCalled()

    // The second step states the consequence before the destructive action.
    expect(screen.getByText(/cannot be undone/)).not.toBeNull()
  })

  it('returning to the picker keeps the field choice made before continuing', () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван' }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan' }),
    ])

    // Switch the name field to the loser's value before continuing.
    const nameGroup = screen.getByRole('radiogroup', { name: /Name/ })
    fireEvent.click(within(nameGroup).getByRole('radio', { name: 'Ivan' }))

    fireEvent.click(continueButton())
    expect(screen.getByText(/cannot be undone/)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Back/ }))

    const nameGroupAgain = screen.getByRole('radiogroup', { name: /Name/ })
    const mergedRadio = within(nameGroupAgain).getByRole<HTMLInputElement>(
      'radio',
      { name: 'Ivan' },
    )
    expect(mergedRadio.checked).toBe(true)
  })

  it('states which survivor fields are overwritten, and from/to what', () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван' }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan' }),
    ])

    const nameGroup = screen.getByRole('radiogroup', { name: /Name/ })
    fireEvent.click(within(nameGroup).getByRole('radio', { name: 'Ivan' }))
    fireEvent.click(continueButton())

    const overrideItem = screen.getByText(/will be replaced with/)
    expect(overrideItem.textContent).toContain('Иван')
    expect(overrideItem.textContent).toContain('Ivan')
  })

  it('omits the override paragraph when nothing is overwritten', () => {
    renderDialog([
      // No conflicting fields at all: nothing for the picker to overwrite.
      candidate({ id: 'a', displayName: 'A', name: null }),
      candidate({ id: 'b', displayName: 'B', name: null }),
    ])

    fireEvent.click(continueButton())

    expect(screen.getByText(/cannot be undone/)).not.toBeNull()
    expect(screen.queryByText(/will be replaced with/)).toBeNull()
  })

  it('merges with the resolved field payload once confirmed', async () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван', conversationCount: 5 }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan', conversationCount: 1 }),
    ])

    fireEvent.click(continueButton())

    // 'name' is a real, two-sided conflict here (Иван vs Ivan) -- it is only
    // *not* switched. The most plausible way to break the override-omission
    // rule is to drop the `choices[field] === 'merged'` filter entirely, which
    // would render an override sentence for every conflict regardless of what
    // was chosen. A pair with no conflicts at all (as in the sibling test)
    // would not catch that: this one does, because a conflict genuinely
    // exists and is deliberately left on the survivor's own value.
    expect(screen.queryByText(/will be replaced with/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Merge$/ }))

    await waitFor(() => expect(merge).toHaveBeenCalledTimes(1))
    // 'a' carries more history, so it is the default survivor and 'b' is merged
    // into it. No field was switched, so nothing is overwritten.
    expect(merge.mock.calls[0][0]).toEqual({
      survivorId: 'a',
      mergedId: 'b',
      fields: {},
    })
  })

  it('sends the resolved payload including a field switched to the loser', async () => {
    renderDialog([
      candidate({ id: 'a', name: 'Иван', displayName: 'Иван', conversationCount: 5 }),
      candidate({ id: 'b', name: 'Ivan', displayName: 'Ivan', conversationCount: 1 }),
    ])

    const nameGroup = screen.getByRole('radiogroup', { name: /Name/ })
    fireEvent.click(within(nameGroup).getByRole('radio', { name: 'Ivan' }))
    fireEvent.click(continueButton())
    fireEvent.click(screen.getByRole('button', { name: /^Merge$/ }))

    await waitFor(() => expect(merge).toHaveBeenCalledTimes(1))
    expect(merge.mock.calls[0][0]).toEqual({
      survivorId: 'a',
      mergedId: 'b',
      fields: { name: 'Ivan' },
    })
  })

  it('never claims a phone count that overstates what actually moves', () => {
    // merge_contacts drops any of the loser's phone rows whose digits the
    // survivor already holds, so count_contact_merge_children's phone_count
    // (everything attached to the loser) can be larger than what the survivor
    // actually gains. The confirmation must not repeat that count as a
    // "moving to X" claim.
    renderDialog([
      candidate({ id: 'a', displayName: 'A', conversationCount: 5 }),
      candidate({ id: 'b', displayName: 'B', conversationCount: 1 }),
    ])

    fireEvent.click(continueButton())

    expect(screen.getByText(/conversation/)).not.toBeNull()
    expect(screen.queryByText(/phone number/)).toBeNull()
  })

  it('states that the counts are still loading, and keeps Merge disabled', () => {
    renderDialog(
      [
        candidate({ id: 'a', displayName: 'A', conversationCount: 5 }),
        candidate({ id: 'b', displayName: 'B', conversationCount: 1 }),
      ],
      { children: { data: undefined, isPending: true, isError: false } },
    )

    fireEvent.click(continueButton())

    expect(screen.getByText(/Checking what will move/)).not.toBeNull()
    // Neither the "still loading" fact nor a stale zero must be confused with
    // "this contact has nothing to move".
    expect(screen.queryByText(/conversation/)).toBeNull()

    const mergeButton = screen.getByRole('button', { name: /^Merge$/ })
    fireEvent.click(mergeButton)
    expect(merge).not.toHaveBeenCalled()
  })

  it('states that the counts failed to load, and keeps Merge disabled', () => {
    renderDialog(
      [
        candidate({ id: 'a', displayName: 'A', conversationCount: 5 }),
        candidate({ id: 'b', displayName: 'B', conversationCount: 1 }),
      ],
      { children: { data: undefined, isPending: false, isError: true } },
    )

    fireEvent.click(continueButton())

    expect(screen.getByText(/Could not check what will move/)).not.toBeNull()
    expect(screen.queryByText(/conversation/)).toBeNull()

    const mergeButton = screen.getByRole('button', { name: /^Merge$/ })
    fireEvent.click(mergeButton)
    expect(merge).not.toHaveBeenCalled()
  })

  it('shows the clash banner without misnaming a channel after a contact', () => {
    // merge_contacts does not return the conflicting channel's identity, so
    // the banner must not repurpose a contact's own name as if it were one --
    // the bug this guards was `contacts_merge_clash_body({ channel:
    // candidateLabel(merged) })`, which read as "в канале «Иван Петров»".
    merge.mockImplementation(
      (
        _input: unknown,
        options: { onError: (error: { message: string }) => void },
      ) => {
        options.onError({ message: 'CONTACT_MERGE_CONVERSATION_CONFLICT' })
      },
    )

    renderDialog([
      candidate({ id: 'a', displayName: 'Иван Петров', conversationCount: 5 }),
      candidate({ id: 'b', displayName: 'Anna Ivanova', conversationCount: 1 }),
    ])

    fireEvent.click(continueButton())
    fireEvent.click(screen.getByRole('button', { name: /^Merge$/ }))

    expect(screen.getByText(/cannot be merged/i)).not.toBeNull()
    expect(screen.getByText(/same channel/i)).not.toBeNull()
    expect(screen.queryByText(/Иван Петров/)).toBeNull()
    expect(screen.queryByText(/Anna Ivanova/)).toBeNull()
  })

  it('resolves an owner_id conflict to the teammate\'s name, not the raw id', () => {
    workspaceMembers = [
      member({ userId: 'user-a', fullName: 'Alice Owner' }),
      member({ userId: 'user-b', fullName: 'Bob Owner' }),
    ]

    renderDialog([
      candidate({ id: 'a', displayName: 'A', ownerId: 'user-a' }),
      candidate({ id: 'b', displayName: 'B', ownerId: 'user-b' }),
    ])

    const ownerGroup = screen.getByRole('radiogroup', { name: /Owner/ })
    expect(
      within(ownerGroup).getByRole('radio', { name: 'Alice Owner' }),
    ).not.toBeNull()
    expect(
      within(ownerGroup).getByRole('radio', { name: 'Bob Owner' }),
    ).not.toBeNull()
    expect(screen.queryByText('user-a')).toBeNull()
    expect(screen.queryByText('user-b')).toBeNull()
  })

  it('falls back to "Not set" when an owner_id conflict cannot be resolved to a name', () => {
    // The roster loaded, but neither owner is in it -- a departed teammate,
    // not a loading state.
    workspaceMembers = [member({ userId: 'someone-else' })]

    renderDialog([
      candidate({ id: 'a', displayName: 'A', ownerId: 'user-a' }),
      candidate({ id: 'b', displayName: 'B', ownerId: 'user-b' }),
    ])

    const ownerGroup = screen.getByRole('radiogroup', { name: /Owner/ })
    expect(
      within(ownerGroup).getAllByRole('radio', { name: 'Not set' }),
    ).toHaveLength(2)
  })

  it('renders an avatar_url conflict as a photo preview, not a raw URL', () => {
    renderDialog([
      candidate({
        id: 'a',
        displayName: 'A',
        avatarUrl: 'https://example.com/a.png',
      }),
      candidate({
        id: 'b',
        displayName: 'B',
        avatarUrl: 'https://example.com/b.png',
      }),
    ])

    const photoGroup = screen.getByRole('radiogroup', { name: /Photo/ })
    expect(within(photoGroup).getAllByRole('radio')).toHaveLength(2)
    expect(within(photoGroup).queryByText(/example\.com/)).toBeNull()
  })

  it('closes without calling merge when cancelled from the picker', () => {
    const onOpenChange = vi.fn()
    renderDialog(
      [
        candidate({ id: 'a', displayName: 'A' }),
        candidate({ id: 'b', displayName: 'B' }),
      ],
      { onOpenChange },
    )

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(merge).not.toHaveBeenCalled()
  })

  it('renders nothing when contacts is null', () => {
    const { container } = renderWithQueryClient(
      <MergeContactsDialog
        workspaceId="ws-1"
        contacts={null}
        onOpenChange={() => {}}
        onMerged={() => {}}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
