import type { Workspace } from '@/entities/workspace'
import type { AttentionItem } from '@/features/dashboard/api/attention-queue'
import type { WorkspaceDashboardStats } from '@/features/dashboard/api/dashboard-stats'
import { describe, expect, it } from 'vitest'
import { resolveHomePrimaryDestination } from './home-primary-destination'

function workspace(id: string, name = id): Workspace {
  return {
    id,
    name,
    description: null,
    icon: null,
    is_main: false,
    created_at: '',
    created_by: 'u1',
    updated_at: '',
    updated_by: null,
    deleted_at: null,
  }
}

function attention(
  workspaceId: string,
  conversationId = `c-${workspaceId}`,
): AttentionItem {
  return {
    conversationId,
    workspaceId,
    contactId: 'ct1',
    contactName: 'Contact',
    contactAvatarUrl: null,
    channelType: 'telegram',
    channelName: 'Main',
    reason: 'unread',
    timestamp: '2026-01-01T00:00:00.000Z',
    preview: null,
  }
}

function stats(workspaceId: string, unread: number): WorkspaceDashboardStats {
  return {
    workspaceId,
    unread,
    open: 0,
    channels: 0,
    contacts: 0,
    channelTypes: [],
    lastMessageAt: null,
  }
}

describe('resolveHomePrimaryDestination', () => {
  it('has no destination without a workspace', () => {
    expect(resolveHomePrimaryDestination([], [], [])).toBeNull()
  })

  it('marks the single workspace as the only one, so the label can stay short', () => {
    expect(
      resolveHomePrimaryDestination([workspace('w1', 'Acme')], [], []),
    ).toEqual({
      workspaceId: 'w1',
      workspaceName: 'Acme',
      isOnlyWorkspace: true,
    })
  })

  it('follows the queue head, so the button agrees with the list under it', () => {
    const result = resolveHomePrimaryDestination(
      [workspace('w1'), workspace('w2', 'EU')],
      [attention('w2'), attention('w1')],
      // Unread would have picked w1; the queue outranks it.
      [stats('w1', 99), stats('w2', 1)],
    )
    expect(result).toEqual({
      workspaceId: 'w2',
      workspaceName: 'EU',
      isOnlyWorkspace: false,
    })
  })

  it('skips a queue item whose workspace is no longer in the list', () => {
    const result = resolveHomePrimaryDestination(
      [workspace('w1'), workspace('w2')],
      [attention('gone'), attention('w2')],
      [],
    )
    expect(result?.workspaceId).toBe('w2')
  })

  it('falls back to the most unread when the queue is empty or still loading', () => {
    const result = resolveHomePrimaryDestination(
      [workspace('w1'), workspace('w2'), workspace('w3')],
      [],
      [stats('w1', 2), stats('w2', 7), stats('w3', 5)],
    )
    expect(result?.workspaceId).toBe('w2')
  })

  it('ignores zero-unread stats rather than treating them as a winner', () => {
    const result = resolveHomePrimaryDestination(
      [workspace('w1'), workspace('w2')],
      [],
      [stats('w1', 0), stats('w2', 0)],
    )
    expect(result?.workspaceId).toBe('w1')
  })

  it('always resolves somewhere, so the page is never without a door', () => {
    const result = resolveHomePrimaryDestination(
      [workspace('w1'), workspace('w2')],
      [],
      [],
    )
    expect(result?.workspaceId).toBe('w1')
    expect(result?.isOnlyWorkspace).toBe(false)
  })
})
