import type { TablesUpdate } from '@/api/types'
import type { Channel } from '@/entities/channel'
import { supabase } from '@/utils/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

export const channelQueryKeys = {
  all: ['channels'] as const,
  list: (workspaceId: string) => ['channels', 'list', workspaceId] as const,
  detail: (channelId: string) => ['channels', 'detail', channelId] as const,
}

const CHANNEL_PUBLIC_COLUMNS =
  'id, workspace_id, type, name, is_active, created_at, updated_at' as const

type ConnectChannelSuccess = { channel: Channel }

export type ChannelConnectErrorCode =
  | 'invalid_token'
  | 'missing_permission'
  | 'phone_mismatch'
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
      const body = (await res.clone().json()) as {
        code?: unknown
        error?: unknown
      }
      message = typeof body.error === 'string' ? body.error : undefined

      if (
        body.code === 'invalid_token' ||
        body.code === 'missing_permission' ||
        body.code === 'phone_mismatch' ||
        body.code === 'unauthorized' ||
        body.code === 'forbidden' ||
        body.code === 'duplicate' ||
        body.code === 'unknown'
      ) {
        return new ChannelConnectError(body.code, message)
      }
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
    .order('created_at', { ascending: false })

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
    await supabase.functions.invoke<ConnectChannelSuccess>(
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

export async function createWhatsappChannel({
  code,
  name,
  phoneNumberId,
  wabaId,
  workspaceId,
}: {
  code: string
  name: string
  phoneNumberId: string
  wabaId: string
  workspaceId: string
}) {
  const trimmedName = name.trim()

  const body: {
    workspace_id: string
    code: string
    phone_number_id: string
    waba_id: string
    name?: string
  } = {
    workspace_id: workspaceId,
    code,
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
  }

  if (trimmedName.length > 0) {
    body.name = trimmedName
  }

  const { data, error } =
    await supabase.functions.invoke<ConnectChannelSuccess>(
      'whatsapp-connect-channel',
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

/**
 * Manual connect: sends Cloud API credentials straight to the connect function,
 * which skips the Embedded Signup code exchange and uses the token as given.
 */
export async function createWhatsappChannelManual({
  accessToken,
  name,
  phoneNumberId,
  wabaId,
  workspaceId,
}: {
  accessToken: string
  name: string
  phoneNumberId: string
  wabaId: string
  workspaceId: string
}) {
  const trimmedName = name.trim()
  const trimmedWabaId = wabaId.trim()

  const body: {
    workspace_id: string
    access_token: string
    phone_number_id: string
    waba_id?: string
    name?: string
  } = {
    workspace_id: workspaceId,
    access_token: accessToken.trim(),
    phone_number_id: phoneNumberId.trim(),
  }

  if (trimmedWabaId.length > 0) {
    body.waba_id = trimmedWabaId
  }

  if (trimmedName.length > 0) {
    body.name = trimmedName
  }

  const { data, error } =
    await supabase.functions.invoke<ConnectChannelSuccess>(
      'whatsapp-connect-channel',
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

/**
 * Rotates an existing WhatsApp channel's credentials after Embedded Signup.
 * The Edge Function keeps the public channel row and its conversation history.
 */
export async function reconnectWhatsappChannel({
  channelId,
  code,
  phoneNumberId,
  wabaId,
  workspaceId,
}: {
  channelId: string
  code: string
  phoneNumberId: string
  wabaId: string
  workspaceId: string
}) {
  const { data, error } =
    await supabase.functions.invoke<ConnectChannelSuccess>(
      'whatsapp-connect-channel',
      {
        body: {
          workspace_id: workspaceId,
          channel_id: channelId,
          code: code.trim(),
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
        },
      },
    )

  if (error) {
    throw await mapFunctionInvokeError(error)
  }

  if (!data?.channel) {
    throw new ChannelConnectError('unknown')
  }

  return data.channel
}

/** Rotates credentials without ever loading the stored secret into the client. */
export async function reconnectWhatsappChannelManual({
  accessToken,
  channelId,
  phoneNumberId,
  wabaId,
  workspaceId,
}: {
  accessToken: string
  channelId: string
  phoneNumberId: string
  wabaId: string
  workspaceId: string
}) {
  const trimmedWabaId = wabaId.trim()
  const body: {
    workspace_id: string
    channel_id: string
    access_token: string
    phone_number_id: string
    waba_id?: string
  } = {
    workspace_id: workspaceId,
    channel_id: channelId,
    access_token: accessToken.trim(),
    phone_number_id: phoneNumberId.trim(),
  }

  if (trimmedWabaId.length > 0) {
    body.waba_id = trimmedWabaId
  }

  const { data, error } =
    await supabase.functions.invoke<ConnectChannelSuccess>(
      'whatsapp-connect-channel',
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

export async function deactivateChannel(id: string) {
  const { error } = await supabase
    .from('channels')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function activateChannel(id: string) {
  const { error } = await supabase
    .from('channels')
    .update({ is_active: true })
    .eq('id', id)

  if (error) {
    throw error
  }
}
