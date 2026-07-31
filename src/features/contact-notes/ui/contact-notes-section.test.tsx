import type { ContactNote } from '@/entities/contact-note'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactNotesSection } from './contact-notes-section'

const api = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  setPinned: vi.fn(),
  update: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../api/contact-notes', () => ({
  createContactNote: api.create,
  deleteContactNote: api.remove,
  listContactNotes: api.list,
  setContactNotePinned: api.setPinned,
  updateContactNoteBody: api.update,
}))

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'alex@example.com' },
    session: null,
    isLoading: false,
    signOut: vi.fn(),
  }),
}))

vi.mock('@/features/account', () => ({
  useMyMemberships: () => ({
    data: [
      {
        id: 'membership-1',
        role: 'member',
        joinedAt: '2026-01-01T00:00:00.000Z',
        workspaceId: 'workspace-1',
        workspaceName: 'Main',
        workspaceIcon: null,
      },
    ],
  }),
}))

vi.mock('@astryxdesign/core/Toast', () => ({
  useToast: () => api.showToast,
}))

const scope = { workspaceId: 'workspace-1', contactId: 'contact-1' }

function note(
  id: string,
  overrides: Partial<ContactNote> = {},
): ContactNote {
  return {
    id,
    workspace_id: scope.workspaceId,
    contact_id: scope.contactId,
    author_id: 'user-1',
    author_name: 'Alex Agent',
    body: `Note ${id}`,
    is_pinned: false,
    created_at: `2026-07-31T10:0${id}:00.000Z`,
    updated_at: `2026-07-31T10:0${id}:00.000Z`,
    ...overrides,
  }
}

function renderSection() {
  return renderWithQueryClient(<ContactNotesSection {...scope} />)
}

async function noteItem(body: string) {
  const text = await screen.findByText(body)
  const item = text.closest('li')
  if (!item) throw new Error(`Could not find note item for ${body}`)
  return item
}

describe('ContactNotesSection', () => {
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
    api.list.mockResolvedValue([])
  })

  it('creates a note and adds it to the contact notes view', async () => {
    api.create.mockImplementation(({ body }: { body: string }) =>
      Promise.resolve(
        note('2', { body, updated_at: '2026-07-31T12:00:00.000Z' }),
      ),
    )
    renderSection()

    const input = await screen.findByLabelText('New note')
    fireEvent.change(input, { target: { value: 'Prefers Telegram' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    expect(await screen.findByText('Prefers Telegram')).not.toBeNull()
    expect((input as HTMLTextAreaElement).value).toBe('')
    expect(api.create).toHaveBeenCalledWith({
      ...scope,
      body: 'Prefers Telegram',
    })
  })

  it('preserves typed content when creation fails', async () => {
    api.create.mockRejectedValue(new Error('offline'))
    renderSection()

    const input = await screen.findByLabelText('New note')
    fireEvent.change(input, { target: { value: 'Follow up after August 10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save the note',
    )
    expect((input as HTMLTextAreaElement).value).toBe(
      'Follow up after August 10',
    )
  })

  it('edits an owned note inline and updates the displayed content', async () => {
    api.list.mockResolvedValue([note('1', { body: 'Old wording' })])
    api.update.mockImplementation(({ body }: { body: string }) =>
      Promise.resolve(
        note('1', {
          body,
          updated_at: '2026-07-31T12:00:00.000Z',
        }),
      ),
    )
    renderSection()

    const item = await noteItem('Old wording')
    fireEvent.click(within(item).getByRole('button', { name: 'Edit note' }))
    const editor = screen.getByLabelText('Edit note')
    fireEvent.change(editor, { target: { value: 'New wording' } })
    fireEvent.click(within(item).getByRole('button', { name: 'Save note' }))

    await waitFor(() => {
      expect(screen.getByText('New wording')).not.toBeNull()
      expect(screen.queryByText('Old wording')).toBeNull()
    })
  })

  it('preserves unsaved inline edit content when updating fails', async () => {
    api.list.mockResolvedValue([note('1', { body: 'Original note' })])
    api.update.mockRejectedValue(new Error('offline'))
    renderSection()

    const item = await noteItem('Original note')
    fireEvent.click(within(item).getByRole('button', { name: 'Edit note' }))
    const editor = screen.getByLabelText('Edit note')
    fireEvent.change(editor, { target: { value: 'Unsaved revision' } })
    fireEvent.click(within(item).getByRole('button', { name: 'Save note' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save the note',
    )
    expect((editor as HTMLTextAreaElement).value).toBe('Unsaved revision')
  })

  it('moves a pinned note ahead of regular notes', async () => {
    api.list.mockResolvedValue([
      note('2', {
        body: 'Newer regular',
        updated_at: '2026-07-31T12:00:00.000Z',
      }),
      note('1', {
        body: 'Older target',
        updated_at: '2026-07-31T10:00:00.000Z',
      }),
    ])
    api.setPinned.mockReturnValue(new Promise(() => {}))
    renderSection()

    const target = await noteItem('Older target')
    fireEvent.click(within(target).getByRole('button', { name: 'Pin note' }))

    await waitFor(() => {
      expect(
        screen.getAllByRole('listitem').map((item) => item.textContent),
      ).toEqual([
        expect.stringContaining('Older target'),
        expect.stringContaining('Newer regular'),
      ])
    })
  })

  it('requires confirmation before deleting a note', async () => {
    api.list.mockResolvedValue([note('1', { body: 'Remember this' })])
    api.remove.mockResolvedValue(undefined)
    renderSection()

    const item = await noteItem('Remember this')
    fireEvent.click(within(item).getByRole('button', { name: 'Delete note' }))

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Delete this note?')).not.toBeNull()
    expect(screen.getByText('Remember this')).not.toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete note' }))

    await waitFor(() =>
      expect(screen.queryByText('Remember this')).toBeNull(),
    )
    expect(api.remove).toHaveBeenCalledWith({ ...scope, noteId: '1' })
  })

  it('keeps a notes load failure inline and offers retry', async () => {
    api.list.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    renderSection()

    expect(await screen.findByText('Could not load notes')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('No notes yet')).not.toBeNull()
  })
})
