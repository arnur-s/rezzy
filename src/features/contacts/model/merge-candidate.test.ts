import { describe, expect, it } from 'vitest'
import type { MergeCandidate } from './merge-candidate'
import {
  defaultSurvivorId,
  mergeConflicts,
  mergeFields,
} from './merge-candidate'

function candidate(patch: Partial<MergeCandidate> = {}): MergeCandidate {
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

describe('defaultSurvivorId', () => {
  it('prefers the contact carrying more history', () => {
    const busy = candidate({ id: 'busy', conversationCount: 4 })
    const quiet = candidate({ id: 'quiet', conversationCount: 1 })
    expect(defaultSurvivorId(quiet, busy)).toBe('busy')
    expect(defaultSurvivorId(busy, quiet)).toBe('busy')
  })

  it('falls back to the most recently seen when history is equal', () => {
    const older = candidate({ id: 'older', lastSeenAt: '2026-01-01T00:00:00Z' })
    const newer = candidate({ id: 'newer', lastSeenAt: '2026-06-01T00:00:00Z' })
    expect(defaultSurvivorId(older, newer)).toBe('newer')
  })

  it('is deterministic when nothing distinguishes them', () => {
    // Two contacts with no history and no last_seen_at must still produce the
    // same default every time the dialog opens, or the pre-selection moves
    // under the user between renders.
    const a = candidate({ id: 'aaa' })
    const b = candidate({ id: 'bbb' })
    expect(defaultSurvivorId(a, b)).toBe(defaultSurvivorId(b, a))
  })
})

describe('mergeConflicts', () => {
  it('reports only fields where both sides hold a different value', () => {
    const survivor = candidate({ id: 's', name: 'Иван', email: 'a@x.ru' })
    const merged = candidate({ id: 'm', name: 'Ivan', email: 'a@x.ru' })

    expect(mergeConflicts(survivor, merged)).toEqual([
      { field: 'name', survivorValue: 'Иван', mergedValue: 'Ivan' },
    ])
  })

  it('is not a conflict when only one side has a value', () => {
    // The merge fills the survivor's empty field from the loser silently: there
    // is no choice to make, and offering one is noise.
    const survivor = candidate({ id: 's', email: null })
    const merged = candidate({ id: 'm', email: 'found@x.ru' })

    expect(mergeConflicts(survivor, merged)).toEqual([])
  })
})

describe('mergeFields', () => {
  it('fills the survivor from the loser where the survivor is empty', () => {
    const survivor = candidate({ id: 's', email: null, ownerId: null })
    const merged = candidate({ id: 'm', email: 'found@x.ru', ownerId: 'u-1' })

    expect(mergeFields(survivor, merged, {})).toEqual({
      email: 'found@x.ru',
      owner_id: 'u-1',
    })
  })

  it('sends only the fields the user actually chose to change', () => {
    const survivor = candidate({ id: 's', name: 'Иван', email: 'a@x.ru' })
    const merged = candidate({ id: 'm', name: 'Ivan', email: 'b@x.ru' })

    // Keeping the survivor's value means sending nothing for that field: the
    // RPC leaves an absent key alone, and an explicit no-op write would be a
    // lie in the audit trail.
    expect(mergeFields(survivor, merged, { name: 'merged', email: 'survivor' })).toEqual({
      name: 'Ivan',
    })
  })

  it('never emits a key outside the RPC allowlist', () => {
    const survivor = candidate({ id: 's' })
    const merged = candidate({ id: 'm', name: 'Other', tags: ['vip'] })

    for (const key of Object.keys(mergeFields(survivor, merged, {}))) {
      expect([
        'name',
        'email',
        'owner_id',
        'status',
        'avatar_url',
        'source',
      ]).toContain(key)
    }
  })
})
