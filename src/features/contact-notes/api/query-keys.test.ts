import { describe, expect, it } from 'vitest'
import { contactNoteQueryKeys } from './query-keys'

describe('contactNoteQueryKeys', () => {
  it('scopes contact note lists by workspace and contact', () => {
    expect(contactNoteQueryKeys.list('workspace-1', 'contact-1')).toEqual([
      'contact-notes',
      'list',
      'workspace-1',
      'contact-1',
    ])

    expect(contactNoteQueryKeys.list('workspace-2', 'contact-1')).not.toEqual(
      contactNoteQueryKeys.list('workspace-1', 'contact-1'),
    )
    expect(contactNoteQueryKeys.list('workspace-1', 'contact-2')).not.toEqual(
      contactNoteQueryKeys.list('workspace-1', 'contact-1'),
    )
  })
})
