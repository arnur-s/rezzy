import type { Channel } from '@/entities/channel'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createInstagramChannel,
  reconnectInstagramChannel,
  reconnectWhatsappChannel,
  reconnectWhatsappChannelManual,
} from './channels'

const supabaseMock = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({
  supabase: {
    functions: { invoke: supabaseMock.invoke },
  },
}))

const whatsappChannel = {
  created_at: '2026-07-17T10:00:00.000Z',
  id: 'channel-1',
  is_active: true,
  name: 'Sales WhatsApp',
  provider_account_id: null,
  type: 'whatsapp',
  updated_at: '2026-07-20T10:00:00.000Z',
  workspace_id: 'workspace-1',
} satisfies Channel

describe('WhatsApp channel reconnect API', () => {
  beforeEach(() => {
    supabaseMock.invoke.mockReset()
  })

  it('reconnects through Embedded Signup without replacing channel identity', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { channel: whatsappChannel },
      error: null,
    })

    await expect(
      reconnectWhatsappChannel({
        channelId: 'channel-1',
        code: ' oauth-code ',
        phoneNumberId: ' 1146328425239572 ',
        wabaId: ' 1553312083160004 ',
        workspaceId: 'workspace-1',
      }),
    ).resolves.toEqual(whatsappChannel)

    expect(supabaseMock.invoke).toHaveBeenCalledWith(
      'whatsapp-connect-channel',
      {
        body: {
          workspace_id: 'workspace-1',
          channel_id: 'channel-1',
          code: 'oauth-code',
          phone_number_id: '1146328425239572',
          waba_id: '1553312083160004',
        },
      },
    )
  })

  it('keeps optional WABA data server-side during a manual reconnect', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { channel: whatsappChannel },
      error: null,
    })

    await reconnectWhatsappChannelManual({
      accessToken: ' new-token ',
      channelId: 'channel-1',
      phoneNumberId: ' 1146328425239572 ',
      wabaId: ' ',
      workspaceId: 'workspace-1',
    })

    expect(supabaseMock.invoke).toHaveBeenCalledWith(
      'whatsapp-connect-channel',
      {
        body: {
          workspace_id: 'workspace-1',
          channel_id: 'channel-1',
          access_token: 'new-token',
          phone_number_id: '1146328425239572',
        },
      },
    )
  })

  it.each([
    ['missing_permission', 400],
    ['phone_mismatch', 409],
  ] as const)('preserves the provider error code %s', async (code, status) => {
    const response = new Response(
      JSON.stringify({ code, error: `Provider rejected: ${code}` }),
      {
        headers: { 'Content-Type': 'application/json' },
        status,
      },
    )
    supabaseMock.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    })

    await expect(
      reconnectWhatsappChannelManual({
        accessToken: 'new-token',
        channelId: 'channel-1',
        phoneNumberId: '1146328425239572',
        wabaId: '1553312083160004',
        workspaceId: 'workspace-1',
      }),
    ).rejects.toMatchObject({ code })
  })
})

const instagramChannel = {
  created_at: '2026-07-17T10:00:00.000Z',
  id: 'ig-channel-1',
  is_active: true,
  name: '@acme',
  provider_account_id: 'IG_1',
  type: 'instagram',
  updated_at: '2026-07-20T10:00:00.000Z',
  workspace_id: 'workspace-1',
} satisfies Channel

describe('Instagram channel connect API', () => {
  beforeEach(() => {
    supabaseMock.invoke.mockReset()
  })

  it('creates a channel from an authorization code + state', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { channel: instagramChannel },
      error: null,
    })

    await expect(
      createInstagramChannel({
        code: 'oauth-code',
        state: 'nonce-abc',
        name: ' Support ',
        workspaceId: 'workspace-1',
      }),
    ).resolves.toEqual(instagramChannel)

    expect(supabaseMock.invoke).toHaveBeenCalledWith('instagram-connect-channel', {
      body: {
        workspace_id: 'workspace-1',
        code: 'oauth-code',
        state: 'nonce-abc',
        name: 'Support',
      },
    })
  })

  it('omits the display name when it is blank', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { channel: instagramChannel },
      error: null,
    })

    await createInstagramChannel({
      code: 'c',
      state: 's',
      name: '   ',
      workspaceId: 'workspace-1',
    })

    expect(supabaseMock.invoke).toHaveBeenCalledWith('instagram-connect-channel', {
      body: { workspace_id: 'workspace-1', code: 'c', state: 's' },
    })
  })

  it('reconnects in place with the channel id', async () => {
    supabaseMock.invoke.mockResolvedValue({
      data: { channel: instagramChannel },
      error: null,
    })

    await reconnectInstagramChannel({
      channelId: 'ig-channel-1',
      code: 'c',
      state: 's',
      workspaceId: 'workspace-1',
    })

    expect(supabaseMock.invoke).toHaveBeenCalledWith('instagram-connect-channel', {
      body: {
        workspace_id: 'workspace-1',
        channel_id: 'ig-channel-1',
        code: 'c',
        state: 's',
      },
    })
  })

  it.each([
    ['state_mismatch', 400],
    ['not_professional', 400],
    ['account_mismatch', 409],
    ['duplicate', 409],
  ] as const)('preserves the provider error code %s', async (code, status) => {
    const response = new Response(
      JSON.stringify({ code, error: `Provider rejected: ${code}` }),
      {
        headers: { 'Content-Type': 'application/json' },
        status,
      },
    )
    supabaseMock.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(response),
    })

    await expect(
      createInstagramChannel({
        code: 'c',
        state: 's',
        name: '',
        workspaceId: 'workspace-1',
      }),
    ).rejects.toMatchObject({ code })
  })
})
