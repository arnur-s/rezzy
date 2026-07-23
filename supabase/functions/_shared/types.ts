// Shared persistence contracts for the provider webhook pipeline.
// Parsing stays per-provider (each function's lib.ts); these types describe the
// normalized records the shared persistence helpers write.

export type Provider = 'telegram' | 'whatsapp' | 'instagram'

export type NormalizedMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'interactive'
  | 'share'
  | 'story_reply'
  | 'story_mention'
  | 'system'
  | 'unsupported'

export type AttachmentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'file'

export type AttachmentDownloadStatus =
  | 'pending'
  | 'downloading'
  | 'stored'
  | 'failed'
  | 'skipped'

export interface AttachmentInput {
  position: number
  kind: AttachmentKind
  providerMediaId?: string | null
  providerMediaUniqueId?: string | null
  storagePath?: string | null
  filename?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  checksum?: string | null
  downloadStatus: AttachmentDownloadStatus
  failureReason?: string | null
  metadata?: Record<string, unknown>
}

export interface NormalizedMessageInput {
  workspaceId: string
  conversationId: string
  channelId: string
  /** Provider message identity (Telegram message_id, wamid, Instagram mid). */
  externalId: string | null
  type: NormalizedMessageType
  content: string | null
  /** Provider message id this message replies to, when the provider sent one. */
  externalReplyToId?: string | null
  providerTimestamp?: string | null
  metadata: Record<string, unknown>
  attachments: AttachmentInput[]
}

export type PersistMessageOutcome =
  | { outcome: 'inserted'; messageId: string }
  | { outcome: 'duplicate' }
  | { outcome: 'error'; message: string }

export type StatusEventStatus =
  | 'queued'
  | 'sending'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'played'
  | 'failed'
  | 'deleted'
  | 'unknown'

export interface StatusEventInput {
  workspaceId: string
  messageId: string
  status: StatusEventStatus
  providerEventId?: string | null
  providerTimestamp?: string | null
  errorCode?: string | null
  errorSubcode?: string | null
  errorType?: string | null
  traceId?: string | null
  retryable?: boolean | null
  metadata?: Record<string, unknown>
}

export interface ReactionOp {
  reactorExternalId: string
  isFromContact: boolean
  emoji: string
  action: 'added' | 'removed'
  providerTimestamp?: string | null
  metadata?: Record<string, unknown>
}

export type ProviderEventStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'ignored'
  | 'failed'

export interface ProviderEventInput {
  workspaceId: string
  channelId: string
  provider: Provider
  eventType: string
  eventFingerprint: string
  payload: Record<string, unknown>
  providerTimestamp?: string | null
}

export type ClaimResult =
  | { outcome: 'claimed'; eventId: string }
  | { outcome: 'duplicate' }
  | { outcome: 'error'; message: string }
