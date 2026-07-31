import type { ContactNote } from './types'
import { describe, expect, it } from 'vitest'
import { sortContactNotes } from './sort-contact-notes'

function note(
  id: string,
  {
    createdAt,
    isPinned = false,
    updatedAt,
  }: {
    createdAt: string
    isPinned?: boolean
    updatedAt: string
  },
): ContactNote {
  return {
    id,
    workspace_id: 'workspace-1',
    contact_id: 'contact-1',
    author_id: 'user-1',
    author_name: 'Agent One',
    body: id,
    is_pinned: isPinned,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

describe('sortContactNotes', () => {
  it('orders pinned notes first and newest updates within each group', () => {
    const regularNew = note('regular-new', {
      createdAt: '2026-07-31T10:00:00Z',
      updatedAt: '2026-07-31T12:00:00Z',
    })
    const pinnedOld = note('pinned-old', {
      createdAt: '2026-07-30T10:00:00Z',
      isPinned: true,
      updatedAt: '2026-07-30T12:00:00Z',
    })
    const pinnedNew = note('pinned-new', {
      createdAt: '2026-07-31T10:00:00Z',
      isPinned: true,
      updatedAt: '2026-07-31T13:00:00Z',
    })
    const regularOld = note('regular-old', {
      createdAt: '2026-07-29T10:00:00Z',
      updatedAt: '2026-07-29T12:00:00Z',
    })

    expect(
      sortContactNotes([regularNew, pinnedOld, pinnedNew, regularOld]),
    ).toEqual([pinnedNew, pinnedOld, regularNew, regularOld])
  })

  it('uses creation time and id as deterministic tie breakers', () => {
    const updatedAt = '2026-07-31T12:00:00Z'
    const newerCreation = note('a', {
      createdAt: '2026-07-31T11:00:00Z',
      updatedAt,
    })
    const idLater = note('z', {
      createdAt: '2026-07-31T10:00:00Z',
      updatedAt,
    })
    const idEarlier = note('b', {
      createdAt: '2026-07-31T10:00:00Z',
      updatedAt,
    })

    expect(sortContactNotes([idEarlier, idLater, newerCreation])).toEqual([
      newerCreation,
      idLater,
      idEarlier,
    ])
  })

  it('does not mutate the source list', () => {
    const first = note('first', {
      createdAt: '2026-07-30T10:00:00Z',
      updatedAt: '2026-07-30T10:00:00Z',
    })
    const second = note('second', {
      createdAt: '2026-07-31T10:00:00Z',
      updatedAt: '2026-07-31T10:00:00Z',
    })
    const source = [first, second]

    sortContactNotes(source)

    expect(source).toEqual([first, second])
  })
})
