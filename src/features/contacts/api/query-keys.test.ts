import { describe, expect, it } from 'vitest'
import { EMPTY_CONTACT_LIST_PARAMS } from '../model/contact-list-params'
import type { ContactListParams } from '../model/contact-list-params'
import { contactQueryKeys } from './query-keys'

const params = (
  overrides: Partial<ContactListParams> = {},
): ContactListParams => ({
  ...EMPTY_CONTACT_LIST_PARAMS,
  ...overrides,
})

describe('contactQueryKeys', () => {
  it('scopes list keys by workspace', () => {
    expect(contactQueryKeys.list('ws-1', params())).toContain('ws-1')
    expect(contactQueryKeys.list('ws-1', params())).not.toEqual(
      contactQueryKeys.list('ws-2', params()),
    )
  })

  it('scopes detail keys by workspace and contact', () => {
    const key = contactQueryKeys.detail('ws-1', 'contact-1')
    expect(key).toContain('ws-1')
    expect(key).toContain('contact-1')
    expect(key).not.toEqual(contactQueryKeys.detail('ws-2', 'contact-1'))
    expect(key).not.toEqual(contactQueryKeys.detail('ws-1', 'contact-2'))
  })

  it.each([
    ['query', { query: 'jane' }],
    ['statuses', { statuses: ['new' as const] }],
    ['tags', { tags: ['vip'] }],
    ['ownerIds', { ownerIds: ['user-1'] }],
    ['includeUnowned', { includeUnowned: true }],
    ['sort', { sort: 'name_asc' as const }],
    ['page', { page: 2 }],
  ])('changes the list key when %s changes', (_label, overrides) => {
    expect(contactQueryKeys.list('ws-1', params(overrides))).not.toEqual(
      contactQueryKeys.list('ws-1', params()),
    )
  })

  it('treats differently ordered filter arrays as one cache entry', () => {
    // TanStack sorts object keys but not array elements, so without the
    // normalisation in serializeParams these would be two entries for one result.
    expect(contactQueryKeys.list('ws-1', params({ tags: ['b', 'a'] }))).toEqual(
      contactQueryKeys.list('ws-1', params({ tags: ['a', 'b'] })),
    )
  })

  it('ignores case and surrounding space in the search term', () => {
    expect(contactQueryKeys.list('ws-1', params({ query: '  Jane ' }))).toEqual(
      contactQueryKeys.list('ws-1', params({ query: 'jane' })),
    )
  })

  it('makes lists(workspaceId) a prefix of that workspace list keys only', () => {
    const prefix = contactQueryKeys.lists('ws-1')
    const own = contactQueryKeys.list('ws-1', params({ page: 3 }))
    const other = contactQueryKeys.list('ws-2', params({ page: 3 }))

    // This is what keeps an invalidation from reaching across workspaces.
    expect(own.slice(0, prefix.length)).toEqual([...prefix])
    expect(other.slice(0, prefix.length)).not.toEqual([...prefix])
  })

  it('does not let the list prefix match detail keys', () => {
    const prefix = contactQueryKeys.lists('ws-1')
    const detail = contactQueryKeys.detail('ws-1', 'contact-1')

    expect(detail.slice(0, prefix.length)).not.toEqual([...prefix])
  })
})
