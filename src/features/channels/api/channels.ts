import type { TablesUpdate } from '@/api/types'
import { supabase } from '@/utils/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

import type { Channel } from '../types'

export const channelQueryKeys = {
  all: ['channels'] as const,
  list: (workspaceId: string) => ['channels', 'list', workspaceId] as const,
  detail: (channelId: string) => ['channels', 'detail', channelId] as const,
}

const CHANNEL_PUBLIC_COLUMNS =
  'id, workspace_id, type, name, is_active, created_at, updated_at' as const

type ConnectTelegramSuccess = { channel: Channel }

export type ChannelConnectErrorCode =
  | 'invalid_token'
  | 'unauthorized'
  | 'forbidden'
  | 'duplicate'
  | 'unknown'

export class ChannelConnectError extends Error {
  readonly code: ChannelConnectErrorCode

  constructor(code: ChannelConnectErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ChannelConnectError'
    this.code = code
  }
}

async function mapFunctionInvokeError(
  error: unknown,
): Promise<ChannelConnectError> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    const status = res.status
    let message: string | undefined
    try {
      const body = (await res.clone().json()) as { error?: string }
      message = body.error
    } catch {
      /* ignore */
    }

    if (status === 400) {
      return new ChannelConnectError('invalid_token', message)
    }
    if (status === 401) {
      return new ChannelConnectError('unauthorized', message)
    }
    if (status === 403) {
      return new ChannelConnectError('forbidden', message)
    }
    if (status === 409) {
      return new ChannelConnectError('duplicate', message)
    }
    return new ChannelConnectError('unknown', message)
  }

  if (error instanceof Error) {
    return new ChannelConnectError('unknown', error.message)
  }

  return new ChannelConnectError('unknown')
}

export async function getWorkspaceChannels(workspaceId: string) {
  const { data, error } = await supabase
    .from('channels')
    .select(CHANNEL_PUBLIC_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data as Array<Channel>
}

export async function createTelegramChannel({
  botToken,
  name,
  workspaceId,
}: {
  botToken: string
  name: string
  workspaceId: string
}) {
  const trimmedToken = botToken.trim()
  const trimmedName = name.trim()

  const body: {
    workspace_id: string
    bot_token: string
    name?: string
  } = {
    bot_token: trimmedToken,
    workspace_id: workspaceId,
  }

  if (trimmedName.length > 0) {
    body.name = trimmedName
  }

  const { data, error } =
    await supabase.functions.invoke<ConnectTelegramSuccess>(
      'telegram-connect-channel',
      { body },
    )

  if (error) {
    throw await mapFunctionInvokeError(error)
  }

  if (!data?.channel) {
    throw new ChannelConnectError('unknown')
  }

  return data.channel
}

export async function updateChannelName({
  id,
  name,
}: {
  id: string
  name: string
}): Promise<Channel> {
  const updatePayload: TablesUpdate<'channels'> = {
    name: name.trim(),
  }

  const { data, error } = await supabase
    .from('channels')
    .update(updatePayload)
    .eq('id', id)
    .select(CHANNEL_PUBLIC_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return data
}

export async function deleteChannel(id: string) {
  const { error } = await supabase.from('channels').delete().eq('id', id)

  if (error) {
    throw error
  }
}
