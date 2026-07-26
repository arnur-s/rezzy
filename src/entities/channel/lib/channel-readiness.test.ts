import type { Channel } from '../model/types'
import { describe, expect, it } from 'vitest'
import { hasActiveChannel } from './channel-readiness'

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    api_version: null,
    created_at: '2026-07-26T00:00:00.000Z',
    id: 'channel-1',
    is_active: true,
    last_error_at: null,
    last_error_code: null,
    last_outbound_at: null,
    last_webhook_at: null,
    name: 'Support bot',
    provider_account_id: null,
    type: 'telegram',
    updated_at: '2026-07-26T00:00:00.000Z',
    workspace_id: 'workspace-1',
    ...overrides,
  }
}

describe('hasActiveChannel', () => {
  it('is false for a workspace with no channels', () => {
    expect(hasActiveChannel([])).toBe(false)
  })

  it('is true when a channel is active', () => {
    expect(hasActiveChannel([channel({ is_active: true })])).toBe(true)
  })

  it('is false when every channel is disconnected', () => {
    expect(
      hasActiveChannel([
        channel({ id: 'a', is_active: false }),
        channel({ id: 'b', is_active: false }),
      ]),
    ).toBe(false)
  })

  it('is true when at least one of several channels is active', () => {
    expect(
      hasActiveChannel([
        channel({ id: 'a', is_active: false }),
        channel({ id: 'b', is_active: true }),
      ]),
    ).toBe(true)
  })

  // A channel that reported an error is still the workspace's live route until
  // it is disconnected; only is_active decides.
  it('counts an active channel that logged a delivery error', () => {
    expect(
      hasActiveChannel([
        channel({
          is_active: true,
          last_error_at: '2026-07-26T10:00:00.000Z',
          last_error_code: 'invalid_token',
        }),
      ]),
    ).toBe(true)
  })

  it('is false while the channel list is still unknown', () => {
    expect(hasActiveChannel(undefined)).toBe(false)
  })
})
