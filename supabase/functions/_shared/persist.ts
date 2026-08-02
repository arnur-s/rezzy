// Shared persistence for normalized webhook records: messages + attachments
// (with storage cleanup on lost insert races), status events, reactions, and
// channel activity. Idempotency relies on database uniqueness — duplicate
// inserts surface as 23505 and are treated as successful dedup, never retried
// into duplicates.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { normalizeReactionEmoji } from './reaction-emoji.ts'
import type {
  AttachmentInput,
  NormalizedMessageInput,
  PersistMessageOutcome,
  ReactionOp,
  StatusEventInput,
} from './types.ts'

const CHAT_MEDIA_BUCKET = 'chat-media'
const UNIQUE_VIOLATION = '23505'

function logDbError(context: string, error: { code?: string; message: string }) {
  console.error(`${context}: ${error.code ?? error.message}`)
}

/** Removes uploaded storage objects after a lost insert race or hard failure. */
export async function cleanupStoredAttachments(
  client: SupabaseClient,
  attachments: AttachmentInput[],
): Promise<void> {
  const paths = attachments
    .filter((a) => a.downloadStatus === 'stored' && a.storagePath)
    .map((a) => a.storagePath as string)
  if (paths.length === 0) return
  const { error } = await client.storage.from(CHAT_MEDIA_BUCKET).remove(paths)
  if (error) {
    console.error('persist: storage cleanup failed', error.message)
  }
}

/**
 * Inserts a normalized inbound message with its attachments, resolves the
 * reply relationship in both directions, and backfills reactions that arrived
 * before the message. The caller must have already stored media (paths are
 * keyed by messageId) — a failed download becomes a failed attachment, never a
 * rejected message.
 */
export async function persistInboundMessage(
  client: SupabaseClient,
  messageId: string,
  input: NormalizedMessageInput,
): Promise<PersistMessageOutcome> {
  // Internal reply target when the parent already exists.
  let replyToMessageId: string | null = null
  if (input.externalReplyToId) {
    const { data: parent } = await client
      .from('messages')
      .select('id')
      .eq('workspace_id', input.workspaceId)
      .eq('conversation_id', input.conversationId)
      .eq('external_id', input.externalReplyToId)
      .maybeSingle()
    replyToMessageId = parent?.id ?? null
  }

  // Legacy dual-write: the first attachment keeps the media_* columns alive
  // for existing rendering, previews, and push text.
  const first = input.attachments[0] ?? null

  const row: Record<string, unknown> = {
    id: messageId,
    workspace_id: input.workspaceId,
    conversation_id: input.conversationId,
    external_id: input.externalId,
    direction: 'inbound',
    type: input.type,
    content: input.content,
    sender_id: null,
    status: 'delivered',
    media_url: first?.storagePath ?? null,
    media_mime_type: first?.mimeType ?? null,
    media_size: first?.sizeBytes ?? null,
    media_filename: first?.filename ?? null,
    reply_to_message_id: replyToMessageId,
    external_reply_to_id: input.externalReplyToId ?? null,
    provider_timestamp: input.providerTimestamp ?? null,
  }
  if (Object.keys(input.metadata).length > 0) {
    row.metadata = input.metadata
  }

  const { error: insertError } = await client.from('messages').insert(row)
  if (insertError) {
    await cleanupStoredAttachments(client, input.attachments)
    if (insertError.code === UNIQUE_VIOLATION) {
      return { outcome: 'duplicate' }
    }
    logDbError('persist: message insert failed', insertError)
    return { outcome: 'error', message: insertError.message }
  }

  if (input.attachments.length > 0) {
    const { error: attachmentsError } = await client
      .from('message_attachments')
      .insert(
        input.attachments.map((a) => ({
          workspace_id: input.workspaceId,
          message_id: messageId,
          position: a.position,
          kind: a.kind,
          provider_media_id: a.providerMediaId ?? null,
          provider_media_unique_id: a.providerMediaUniqueId ?? null,
          storage_path: a.storagePath ?? null,
          filename: a.filename ?? null,
          mime_type: a.mimeType ?? null,
          size_bytes: a.sizeBytes ?? null,
          width: a.width ?? null,
          height: a.height ?? null,
          duration_seconds: a.durationSeconds ?? null,
          checksum: a.checksum ?? null,
          download_status: a.downloadStatus,
          failure_reason: a.failureReason ?? null,
          metadata: a.metadata ?? {},
        })),
      )
    if (attachmentsError && attachmentsError.code !== UNIQUE_VIOLATION) {
      // Attachment bookkeeping failure must not reject the stored message.
      logDbError('persist: attachments insert failed', attachmentsError)
    }
  }

  if (input.externalId) {
    // Late-parent backfill: children that referenced this provider message id.
    const { error: replyBackfillError } = await client
      .from('messages')
      .update({ reply_to_message_id: messageId })
      .eq('conversation_id', input.conversationId)
      .eq('external_reply_to_id', input.externalId)
      .is('reply_to_message_id', null)
    if (replyBackfillError) {
      logDbError('persist: reply backfill failed', replyBackfillError)
    }

    // Reactions that arrived before their message.
    const { error: reactionBackfillError } = await client
      .from('message_reactions')
      .update({
        message_id: messageId,
        conversation_id: input.conversationId,
      })
      .eq('channel_id', input.channelId)
      .eq('provider_message_id', input.externalId)
      .is('message_id', null)
    if (reactionBackfillError) {
      logDbError('persist: reaction backfill failed', reactionBackfillError)
    }
  }

  return { outcome: 'inserted', messageId }
}

/** Appends a status event; the DB trigger projects it onto messages.status. */
export async function insertStatusEvent(
  client: SupabaseClient,
  input: StatusEventInput,
): Promise<{ inserted: boolean }> {
  const { error } = await client.from('message_status_events').insert({
    workspace_id: input.workspaceId,
    message_id: input.messageId,
    status: input.status,
    provider_event_id: input.providerEventId ?? null,
    provider_timestamp: input.providerTimestamp ?? null,
    error_code: input.errorCode ?? null,
    error_subcode: input.errorSubcode ?? null,
    error_type: input.errorType ?? null,
    trace_id: input.traceId ?? null,
    retryable: input.retryable ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { inserted: false }
    logDbError('persist: status event insert failed', error)
    return { inserted: false }
  }
  return { inserted: true }
}

export interface ReactionTarget {
  workspaceId: string
  channelId: string
  providerMessageId: string
  /** Known when the provider scopes the callback to a conversation. */
  conversationId?: string | null
  messageId?: string | null
}

/**
 * Applies reaction ops idempotently: one row per (channel, provider message,
 * reactor, emoji), flipped between added/removed. A provider_timestamp guard
 * keeps out-of-order callbacks from reverting newer state. With
 * `replaceOthers`, the reactor's other added emojis are first flipped to
 * removed (WhatsApp replace semantics).
 *
 * Emoji identity is canonicalized here as well as in the provider helpers: this
 * is the boundary the unique key is matched on, so no caller can write a
 * variant form that would split one reaction into two rows.
 */
export async function applyReactionOps(
  client: SupabaseClient,
  target: ReactionTarget,
  ops: ReactionOp[],
  options: { replaceOthers?: { reactorExternalId: string; keepEmoji?: string } } = {},
): Promise<string[]> {
  let messageId = target.messageId ?? null
  let conversationId = target.conversationId ?? null
  if (!messageId) {
    let lookup = client
      .from('messages')
      .select('id, conversation_id')
      .eq('workspace_id', target.workspaceId)
      .eq('external_id', target.providerMessageId)
    if (conversationId) {
      lookup = lookup.eq('conversation_id', conversationId)
    }
    const { data: message } = await lookup.limit(1).maybeSingle()
    if (message) {
      messageId = message.id
      conversationId = message.conversation_id
    }
  }

  if (options.replaceOthers) {
    let replace = client
      .from('message_reactions')
      .update({ action: 'removed' })
      .eq('channel_id', target.channelId)
      .eq('provider_message_id', target.providerMessageId)
      .eq('reactor_external_id', options.replaceOthers.reactorExternalId)
      .eq('action', 'added')
    if (options.replaceOthers.keepEmoji) {
      replace = replace.neq(
        'emoji',
        normalizeReactionEmoji(options.replaceOthers.keepEmoji),
      )
    }
    const { error } = await replace
    if (error) logDbError('persist: reaction replace failed', error)
  }

  const affectedIds: string[] = []
  for (const op of ops) {
    const emoji = normalizeReactionEmoji(op.emoji)
    const values: Record<string, unknown> = {
      action: op.action,
      provider_timestamp: op.providerTimestamp ?? null,
      is_from_contact: op.isFromContact,
      ...(messageId ? { message_id: messageId } : {}),
      ...(conversationId ? { conversation_id: conversationId } : {}),
      ...(op.metadata ? { metadata: op.metadata } : {}),
    }
    let update = client
      .from('message_reactions')
      .update(values)
      .eq('channel_id', target.channelId)
      .eq('provider_message_id', target.providerMessageId)
      .eq('reactor_external_id', op.reactorExternalId)
      .eq('emoji', emoji)
    if (op.providerTimestamp) {
      update = update.or(
        `provider_timestamp.is.null,provider_timestamp.lte.${op.providerTimestamp}`,
      )
    }
    const { data: updated, error: updateError } = await update.select('id')
    if (updateError) {
      logDbError('persist: reaction update failed', updateError)
      continue
    }
    if (updated && updated.length > 0) {
      affectedIds.push(...updated.map((r: { id: string }) => r.id))
      continue
    }

    const { data: insertedRow, error: insertError } = await client
      .from('message_reactions')
      .insert({
        workspace_id: target.workspaceId,
        channel_id: target.channelId,
        conversation_id: conversationId,
        message_id: messageId,
        provider_message_id: target.providerMessageId,
        reactor_external_id: op.reactorExternalId,
        is_from_contact: op.isFromContact,
        emoji,
        action: op.action,
        provider_timestamp: op.providerTimestamp ?? null,
        metadata: op.metadata ?? {},
      })
      .select('id')
      .maybeSingle()
    if (insertError) {
      // A concurrent instance inserted the row first (or the guard rejected a
      // stale update): both are successful dedup, not failures.
      if (insertError.code !== UNIQUE_VIOLATION) {
        logDbError('persist: reaction insert failed', insertError)
      }
      continue
    }
    if (insertedRow) affectedIds.push(insertedRow.id)
  }
  return affectedIds
}

export interface ResolveIdentityArgs {
  workspaceId: string
  channelId: string
  channelType: 'telegram' | 'whatsapp' | 'instagram'
  externalId: string
  externalName: string
  profile: Record<string, unknown>
  /** Backfilled onto the CRM contact only while contacts.phone is null. */
  phone?: string | null
  externalThreadId?: string | null
  createIfMissing: boolean
}

/**
 * Resolves (or creates) the provider identity, CRM contact, and conversation
 * for an inbound event. Identities are channel-scoped; identities predating
 * channel scoping (channel_id null) are adopted instead of duplicating the
 * contact. Never merges contacts by name/username/phone heuristics.
 */
export async function resolveContactAndConversation(
  client: SupabaseClient,
  args: ResolveIdentityArgs,
): Promise<{ contactId: string; conversationId: string } | null> {
  const now = new Date().toISOString()

  let { data: identity } = await client
    .from('contact_channels')
    .select('contact_id')
    .eq('channel_id', args.channelId)
    .eq('external_id', args.externalId)
    .maybeSingle()

  if (!identity) {
    const { data: legacyIdentity } = await client
      .from('contact_channels')
      .select('id, contact_id')
      .eq('workspace_id', args.workspaceId)
      .eq('channel_type', args.channelType)
      .eq('external_id', args.externalId)
      .is('channel_id', null)
      .maybeSingle()
    if (legacyIdentity) {
      const { error: adoptError } = await client
        .from('contact_channels')
        .update({ channel_id: args.channelId })
        .eq('id', legacyIdentity.id)
      if (!adoptError) {
        identity = { contact_id: legacyIdentity.contact_id }
      }
    }
  }

  let contactId: string

  if (identity) {
    contactId = identity.contact_id
    await client
      .from('contact_channels')
      .update({
        external_name: args.externalName,
        ...(Object.keys(args.profile).length > 0
          ? { profile: args.profile, profile_synced_at: now }
          : {}),
      })
      .eq('channel_id', args.channelId)
      .eq('external_id', args.externalId)
    if (args.phone) {
      await client
        .from('contacts')
        .update({ phone: args.phone })
        .eq('id', contactId)
        .is('phone', null)
    }
  } else {
    if (!args.createIfMissing) return null
    const { data: newContact, error: contactError } = await client
      .from('contacts')
      .insert({
        workspace_id: args.workspaceId,
        name: args.externalName,
        status: 'new',
        ...(args.phone ? { phone: args.phone } : {}),
      })
      .select('id')
      .single()
    if (contactError || !newContact) {
      logDbError('persist: contact create failed', contactError ?? { message: 'no row' })
      return null
    }
    contactId = newContact.id
    const { error: identityError } = await client.from('contact_channels').insert({
      workspace_id: args.workspaceId,
      contact_id: contactId,
      channel_id: args.channelId,
      channel_type: args.channelType,
      external_id: args.externalId,
      external_name: args.externalName,
      ...(Object.keys(args.profile).length > 0
        ? { profile: args.profile, profile_synced_at: now }
        : {}),
    })
    if (identityError) {
      logDbError('persist: identity create failed', identityError)
    }
  }

  const { data: existingConversation } = await client
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('channel_id', args.channelId)
    .maybeSingle()

  if (existingConversation) {
    return { contactId, conversationId: existingConversation.id }
  }

  if (!args.createIfMissing) return null

  const { data: newConversation, error: convError } = await client
    .from('conversations')
    .insert({
      workspace_id: args.workspaceId,
      contact_id: contactId,
      channel_id: args.channelId,
      status: 'open',
      external_thread_id: args.externalThreadId ?? args.externalId,
    })
    .select('id')
    .single()
  if (convError || !newConversation) {
    logDbError('persist: conversation create failed', convError ?? { message: 'no row' })
    return null
  }
  return { contactId, conversationId: newConversation.id }
}

/** Best-effort channel provider-activity bookkeeping. */
export async function touchChannelActivity(
  client: SupabaseClient,
  channelId: string,
  kind: 'webhook' | 'outbound' | 'error',
  errorCode?: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const values: Record<string, unknown> =
    kind === 'webhook'
      ? { last_webhook_at: now }
      : kind === 'outbound'
        ? { last_outbound_at: now }
        : { last_error_at: now, last_error_code: errorCode ?? null }
  const { error } = await client.from('channels').update(values).eq('id', channelId)
  if (error) {
    logDbError('persist: channel activity update failed', error)
  }
}
