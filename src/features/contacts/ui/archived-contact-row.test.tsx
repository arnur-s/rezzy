import { setLocale } from '@/paraglide/runtime'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchivedContact } from '../api/contacts'
import { ArchivedContactRow } from './archived-contact-row'

function archivedContact(
  overrides: Partial<ArchivedContact> = {},
): ArchivedContact {
  return {
    id: 'contact-1',
    workspace_id: 'ws-1',
    name: 'Jamie Rivera',
    display_name: 'Jamie Rivera',
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
    total_count: 1,
    deleted_at: '2026-08-01T00:00:00.000Z',
    conversation_count: 0,
    merged_into_id: null,
    merged_into_name: null,
    ...overrides,
  }
}

function renderRow(overrides: Partial<ArchivedContact> = {}) {
  const onRestore = vi.fn()
  render(
    <ul>
      <ArchivedContactRow
        contact={archivedContact(overrides)}
        onRestore={onRestore}
        isRestoring={false}
      />
    </ul>,
  )
  return { onRestore }
}

describe('ArchivedContactRow', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
  })

  it('offers Restore for an ordinary archived contact', () => {
    renderRow()

    expect(
      screen.getByRole('button', { name: 'Restore from archive' }),
    ).not.toBeNull()
    expect(screen.queryByText(/Merged into/)).toBeNull()
  })

  it('names the survivor and drops Restore for a merged contact', () => {
    renderRow({ merged_into_id: 'contact-2', merged_into_name: 'Alex Chen' })

    expect(screen.getByText('Merged into "Alex Chen"')).not.toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Restore from archive' }),
    ).toBeNull()
  })
})
