import { describe, expect, it } from 'vitest'
import type { WorkspaceMember } from '../model/member'
import { workspaceMemberLabels } from './member-labels'

function member(partial: Partial<WorkspaceMember> & { userId: string }) {
  return {
    role: 'member' as const,
    fullName: 'Арнур Купанов',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    joinedAt: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('workspaceMemberLabels', () => {
  it('leaves an unambiguous name alone', () => {
    const labels = workspaceMemberLabels([
      member({ userId: 'a' }),
      member({ userId: 'b', fullName: 'Анна Петрова' }),
    ])

    expect(labels.get('a')).toBe('Арнур Купанов')
    expect(labels.get('b')).toBe('Анна Петрова')
  })

  it('separates a shared name by job title', () => {
    const labels = workspaceMemberLabels([
      member({ userId: 'a', jobTitle: 'Поддержка' }),
      member({ userId: 'b', jobTitle: 'Продажи' }),
    ])

    expect(labels.get('a')).toBe('Арнур Купанов · Поддержка')
    expect(labels.get('b')).toBe('Арнур Купанов · Продажи')
  })

  it('numbers every clashing row, not just the second', () => {
    const labels = workspaceMemberLabels([
      member({ userId: 'a' }),
      member({ userId: 'b' }),
      member({ userId: 'c', jobTitle: 'Продажи' }),
    ])

    expect(labels.get('a')).toBe('Арнур Купанов (1)')
    expect(labels.get('b')).toBe('Арнур Купанов (2)')
    expect(labels.get('c')).toBe('Арнур Купанов · Продажи')
  })

  it('stays unique when the job title is shared too', () => {
    // The whole point: DropdownMenu keys items by label, so a collision that
    // survives the tiebreaker is a duplicate React key.
    const labels = workspaceMemberLabels([
      member({ userId: 'a', jobTitle: 'Поддержка' }),
      member({ userId: 'b', jobTitle: 'Поддержка' }),
      member({ userId: 'c', jobTitle: 'Продажи' }),
    ])

    expect(new Set(labels.values()).size).toBe(3)
    expect(labels.get('a')).toBe('Арнур Купанов · Поддержка (1)')
    expect(labels.get('b')).toBe('Арнур Купанов · Поддержка (2)')
  })
})
