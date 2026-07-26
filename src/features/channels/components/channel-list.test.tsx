import type { Channel } from '@/entities/channel'
import type * as ChannelsApi from '../api/channels'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChannelList } from './channel-list'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return { ...actual, useNavigate: () => navigateMock }
})

const getWorkspaceChannelsMock = vi.hoisted(() => vi.fn())

vi.mock('../api/channels', async () => {
  const actual = await vi.importActual<typeof ChannelsApi>('../api/channels')
  return { ...actual, getWorkspaceChannels: getWorkspaceChannelsMock }
})

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

describe('ChannelList', () => {
  // The project's base locale is ru; these assertions read the English copy.
  beforeAll(() => {
    setLocale('en')
  })

  beforeEach(() => {
    navigateMock.mockReset()
    getWorkspaceChannelsMock.mockReset()
  })

  // This is where onboarding drops a brand-new workspace, so the empty state has
  // to explain why the user is here and what it unlocks.
  it('explains what connecting a channel unlocks when there are none', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([])

    renderWithQueryClient(<ChannelList workspaceId="workspace-1" />)

    expect(
      await screen.findByText('Connect your first channel'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Add a channel to start receiving customer conversations and unlock your inbox',
      ),
    ).toBeTruthy()
  })

  it('offers no way into the inbox while no channel is connected', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([])

    renderWithQueryClient(<ChannelList workspaceId="workspace-1" />)

    await screen.findByText('Connect your first channel')
    expect(screen.queryByRole('button', { name: 'Open inbox' })).toBeNull()
  })

  it('offers a way into the inbox once a channel is active', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([channel({ is_active: true })])

    renderWithQueryClient(<ChannelList workspaceId="workspace-1" />)

    expect(await screen.findByText('Your inbox is ready')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$id/inbox',
      params: { id: 'workspace-1' },
    })
  })

  // Disconnecting the last channel locks the inbox again, so the invitation to
  // open it has to disappear with it.
  it('withdraws the inbox link when every channel is disconnected', async () => {
    getWorkspaceChannelsMock.mockResolvedValue([channel({ is_active: false })])

    renderWithQueryClient(<ChannelList workspaceId="workspace-1" />)

    // The card renders, so the list has loaded before we assert on the absence.
    expect(await screen.findByText('Support bot')).toBeTruthy()
    expect(screen.queryByText('Your inbox is ready')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open inbox' })).toBeNull()
  })
})
