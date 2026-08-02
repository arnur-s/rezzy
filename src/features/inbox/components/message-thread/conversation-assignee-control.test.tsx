import type { WorkspaceMember } from '@/entities/workspace'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversationAssigneeControl } from './conversation-assignee-control'

const listWorkspaceMembers = vi.hoisted(() => vi.fn())
const updateConversationAssignee = vi.hoisted(() => vi.fn())

vi.mock('@/features/workspaces/api/workspaces', async () => {
  const actual = await vi.importActual('@/features/workspaces/api/workspaces')
  return { ...actual, listWorkspaceMembers }
})

vi.mock('../../api/conversations', async () => {
  const actual = await vi.importActual('../../api/conversations')
  return { ...actual, updateConversationAssignee }
})

const ANNA: WorkspaceMember = {
  userId: 'user-anna',
  role: 'admin',
  fullName: 'Anna Petrova',
  avatarUrl: null,
  jobTitle: 'Account manager',
  phone: '+7 916 555-01-22',
  joinedAt: '2026-01-01T00:00:00Z',
}

const IVAN: WorkspaceMember = {
  userId: 'user-ivan',
  role: 'member',
  fullName: 'Ivan Sidorov',
  avatarUrl: null,
  jobTitle: null,
  phone: null,
  joinedAt: '2026-02-01T00:00:00Z',
}

function renderControl(assignedTo: string | null, currentUserId = 'user-ivan') {
  return renderWithQueryClient(
    <ConversationAssigneeControl
      workspaceId="workspace-1"
      conversationId="conv-1"
      assignedTo={assignedTo}
      currentUserId={currentUserId}
    />,
  )
}

describe('ConversationAssigneeControl', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    listWorkspaceMembers.mockResolvedValue([ANNA, IVAN])
    updateConversationAssignee.mockResolvedValue(undefined)
  })

  // The name appears in three places at once — on the trigger, in the roster
  // menu and on the hover card, all of which stay mounted — so every assertion
  // here names the trigger by role rather than fishing for the text.
  it('names the assignee once the roster resolves the stored id', async () => {
    renderControl('user-anna')

    expect(
      await screen.findByRole('button', { name: 'Assigned to Anna Petrova' }),
    ).toBeTruthy()
  })

  /**
   * The state the old header could not show at all: it rendered the assignee
   * line only when `assigned_profile` was set, so an unassigned conversation —
   * the one that most needs an owner — had no pixels in the header.
   */
  it('offers the assign action when nobody owns the conversation', async () => {
    renderControl(null)

    expect(await screen.findByRole('button', { name: 'Assign' })).toBeTruthy()
  })

  it('assigns to the signed-in agent from the menu', async () => {
    renderControl(null)

    fireEvent.click(await screen.findByRole('button', { name: /assign/i }))
    fireEvent.click(await screen.findByText('Assign to me'))

    await waitFor(() => {
      expect(updateConversationAssignee).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        assignedTo: 'user-ivan',
      })
    })
  })

  it('clears the assignee, and only offers to when there is one', async () => {
    const { rerender } = renderControl(null)

    fireEvent.click(await screen.findByRole('button', { name: /assign/i }))
    expect(screen.queryByText('Clear assignee')).toBeNull()

    rerender(
      <ConversationAssigneeControl
        workspaceId="workspace-1"
        conversationId="conv-1"
        assignedTo="user-anna"
        currentUserId="user-ivan"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: /assigned to anna petrova/i }))
    fireEvent.click(await screen.findByText('Clear assignee'))

    await waitFor(() => {
      expect(updateConversationAssignee).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        assignedTo: null,
      })
    })
  })

  /**
   * A member can be removed from a workspace without the conversations they own
   * being reassigned, so an id that resolves to nobody is a real state rather
   * than a bug. It must not read as "unassigned": that would invite an agent to
   * assume the thread is free when the history says otherwise.
   */
  it('distinguishes an unresolvable assignee from an unassigned one', async () => {
    renderControl('user-who-left')

    expect(
      await screen.findByRole('button', { name: 'Assigned to Former member' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull()
  })

  it('says so when the roster cannot be loaded instead of showing an empty menu', async () => {
    listWorkspaceMembers.mockRejectedValue(new Error('nope'))
    renderControl(null)

    fireEvent.click(await screen.findByRole('button', { name: /assign/i }))

    expect(
      await screen.findByText('Could not load workspace members'),
    ).toBeTruthy()
  })
})
