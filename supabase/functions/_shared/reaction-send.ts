// Outbound reaction mapping, one provider at a time.
//
// Everything here is pure: a canonical command in, an HTTP request description
// or a verdict out. The network call, the credentials, and the database writes
// stay in send-reaction/index.ts, so the part that is easy to get wrong — the
// payload shape, the emoji spelling, which failures are worth retrying — is the
// part that is unit-testable.
//
// Canonical emoji arrive here; provider spelling leaves here. This is the only
// boundary allowed to re-qualify an emoji (see qualifyReactionEmoji).

import { normalizeReactionEmoji, qualifyReactionEmoji } from './reaction-emoji.ts'

/** Providers that accept a reaction from the business account. */
export type ReactionProvider = 'telegram' | 'whatsapp' | 'instagram'

/**
 * The reactor id recorded for a reaction this workspace sent.
 *
 * No provider hands back a reactor identity for the business account's own
 * reaction, so our side supplies a stable one; without it the same agent
 * reacting twice would write two rows and count twice. Namespaced with a colon
 * so it cannot collide with a real provider identity — those are numeric
 * (Telegram user id, IGSID) or an E.164 phone (`wa_id`).
 *
 * Mirrors `OUTBOUND_REACTOR_ID` in src/entities/message/lib/reaction-identity.ts:
 * the app computes the same value for its optimistic row, and the two must
 * agree or a confirmation would land beside the optimistic entry instead of
 * replacing it. Pinned by `reaction-send.test.ts`.
 */
export const OUTBOUND_REACTOR_ID = 'rezzy:business'

/**
 * The reaction set the product offers, canonical. Revalidated on the server
 * because the browser is not a trusted source for what a provider accepts.
 *
 * Mirrors `SUPPORTED_REACTIONS` in src/entities/channel, and pinned to it by
 * `reaction-send.test.ts`.
 */
export const SUPPORTED_REACTION_EMOJI: ReadonlyArray<string> = [
  '👍',
  '❤',
  '😂',
  '😮',
  '😢',
  '🙏',
].map(normalizeReactionEmoji)

/**
 * The canonical outbound command. `emoji: null` is a removal — every supported
 * provider expresses removal as "the empty reaction" rather than as a separate
 * endpoint, so a dedicated command would only be unwrapped again here.
 */
export interface SendReactionCommand {
  providerMessageId: string
  emoji: string | null
}

export interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export type ProviderOutcome =
  | { ok: true; providerReactionId: string | null }
  | {
      ok: false
      /** Stable, non-secret code recorded on the channel and in logs. */
      code: string
      /** Provider prose, for logs only; never returned to the browser. */
      detail: string | null
      /** Whether the same request could succeed later untouched. */
      isRetryable: boolean
    }

// ─── Telegram ────────────────────────────────────────────────────────────────

/**
 * `setMessageReaction`: the reaction list is the whole state, so one call
 * covers add, replace, and remove. An empty list removes; a one-element list
 * replaces whatever was there.
 *
 * Telegram's allowed emoji are listed in their bare form (`❤`, not `❤️`), which
 * is canonical form already — so this provider takes the emoji unqualified.
 */
export function buildTelegramReactionRequest(args: {
  botToken: string
  chatId: string
  command: SendReactionCommand
}): ProviderRequest {
  const messageId = Number(args.command.providerMessageId)
  const emoji = args.command.emoji
    ? normalizeReactionEmoji(args.command.emoji)
    : null

  return {
    url: `https://api.telegram.org/bot${args.botToken}/setMessageReaction`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: args.chatId,
      message_id: messageId,
      reaction: emoji ? [{ type: 'emoji', emoji }] : [],
    }),
  }
}

interface TelegramResponse {
  ok?: boolean
  result?: unknown
  error_code?: number
  description?: string
}

/**
 * Telegram answers `true` on success and carries no reaction id, so there is
 * nothing to reconcile against later — our own row is the only record.
 */
export function interpretTelegramReactionResponse(
  status: number,
  json: TelegramResponse | null,
): ProviderOutcome {
  if (json?.ok && json.result !== false) {
    return { ok: true, providerReactionId: null }
  }

  const description = json?.description ?? null
  const errorCode = json?.error_code ?? status

  return {
    ok: false,
    code: telegramErrorCode(errorCode, description),
    detail: description,
    // 429 is a rate limit and 5xx is Telegram being unwell; both are the same
    // request succeeding later. A 400 means the request itself is wrong.
    isRetryable: errorCode === 429 || errorCode >= 500,
  }
}

/**
 * Telegram reports every rejection as 400 with prose, so the prose is the only
 * way to tell "this message is too old" from "this emoji is not allowed". The
 * match is deliberately loose: an unrecognized description falls through to a
 * generic code rather than being asserted as something specific.
 */
function telegramErrorCode(
  errorCode: number,
  description: string | null,
): string {
  if (errorCode === 429) return 'rate_limited'

  const text = description?.toLowerCase() ?? ''
  if (text.includes('reaction_invalid')) return 'emoji_unsupported'
  if (text.includes('message to react not found')) return 'message_unavailable'
  if (text.includes('message_id_invalid')) return 'message_unavailable'
  if (text.includes('chat not found')) return 'message_unavailable'
  if (text.includes('not enough rights')) return 'reactions_forbidden'
  if (text.includes('unauthorized')) return 'channel_unauthorized'
  return `telegram_${errorCode}`
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

/**
 * A reaction is an ordinary outbound message of type `reaction` addressed to
 * the target `wamid`. An empty emoji string withdraws it, and a further
 * reaction replaces the previous one implicitly — the same semantics the
 * inbound pipeline already assumes for the customer's side.
 *
 * WhatsApp echoes the fully-qualified spelling (`❤️`), so the emoji is
 * re-qualified on the way out even though it is stored bare.
 */
export function buildWhatsappReactionRequest(args: {
  graphUrl: string
  accessToken: string
  phoneNumberId: string
  recipientId: string
  command: SendReactionCommand
}): ProviderRequest {
  return {
    url: `${args.graphUrl}/${args.phoneNumberId}/messages`,
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: args.recipientId,
      type: 'reaction',
      reaction: {
        message_id: args.command.providerMessageId,
        emoji: args.command.emoji ? qualifyReactionEmoji(args.command.emoji) : '',
      },
    }),
  }
}

interface WhatsappResponse {
  messages?: Array<{ id?: string }>
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    type?: string
  }
}

export function interpretWhatsappReactionResponse(
  status: number,
  json: WhatsappResponse | null,
): ProviderOutcome {
  if (status >= 200 && status < 300 && !json?.error) {
    // The id identifies the reaction message, not the reaction itself; it is
    // recorded for support traceability rather than used as an identity.
    return { ok: true, providerReactionId: json?.messages?.[0]?.id ?? null }
  }

  const error = json?.error
  const code = error?.code ?? status

  return {
    ok: false,
    code: whatsappErrorCode(code, error?.error_subcode ?? null),
    detail: error?.message ?? null,
    isRetryable: code === 4 || code === 80007 || code === 131048 || status >= 500,
  }
}

/**
 * Graph error codes, from WhatsApp Cloud API's documented list. Unmapped codes
 * keep their numeric identity rather than being flattened into one bucket, so a
 * failure we have not seen before is still diagnosable from the channel record.
 */
function whatsappErrorCode(code: number, subcode: number | null): string {
  switch (code) {
    case 4:
    case 80007:
    case 131048:
      return 'rate_limited'
    case 190:
      return 'channel_unauthorized'
    case 131047:
      // Re-engagement required: outside the 24-hour customer service window.
      return 'window_expired'
    case 131026:
      return 'message_undeliverable'
    case 132000:
    case 131009:
      return subcode === 2494010 ? 'emoji_unsupported' : 'invalid_request'
    default:
      return `whatsapp_${code}`
  }
}

// ─── Instagram ───────────────────────────────────────────────────────────────

/**
 * A reaction is a `sender_action` on the same `/messages` endpoint the text
 * sender uses, not a message of its own. `react` both adds and edits — Meta's
 * documented way to change a reaction is to repeat the call with a different
 * emoji — and `unreact` withdraws, carrying only the message id.
 *
 * The emoji is sent fully qualified: Meta accepts "any emoji reaction" and
 * echoes the display form back through the webhook, which is what the inbound
 * pipeline then canonicalizes.
 */
export function buildInstagramReactionRequest(args: {
  graphUrl: string
  accessToken: string
  instagramUserId: string
  recipientId: string
  command: SendReactionCommand
}): ProviderRequest {
  const isRemoval = !args.command.emoji

  return {
    url: `${args.graphUrl}/${args.instagramUserId}/messages`,
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: args.recipientId },
      sender_action: isRemoval ? 'unreact' : 'react',
      payload: isRemoval
        ? { message_id: args.command.providerMessageId }
        : {
            message_id: args.command.providerMessageId,
            reaction: qualifyReactionEmoji(args.command.emoji ?? ''),
          },
    }),
  }
}

interface InstagramResponse {
  recipient_id?: string
  message_id?: string
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    type?: string
  }
}

export function interpretInstagramReactionResponse(
  status: number,
  json: InstagramResponse | null,
): ProviderOutcome {
  if (status >= 200 && status < 300 && !json?.error) {
    // A sender_action answers with the recipient, not with a reaction id, so
    // there is nothing durable to reconcile against — our row is the record.
    return { ok: true, providerReactionId: null }
  }

  const error = json?.error
  const code = error?.code ?? status

  return {
    ok: false,
    code: instagramErrorCode(code, error?.error_subcode ?? null),
    detail: error?.message ?? null,
    isRetryable: code === 4 || code === 613 || code === 2 || status >= 500,
  }
}

/**
 * Instagram messaging rides the Graph error space, so the common codes carry
 * their usual meaning. Unmapped codes keep their numeric identity rather than
 * being flattened, so a failure we have not seen before stays diagnosable.
 */
function instagramErrorCode(code: number, subcode: number | null): string {
  switch (code) {
    case 4:
    case 613:
      return 'rate_limited'
    case 190:
      return 'channel_unauthorized'
    case 10:
      // Outside the messaging window: the reaction is refused for the same
      // reason a message would be.
      return subcode === 2534022 ? 'window_expired' : 'reactions_forbidden'
    case 100:
      // A malformed target is far more often a message Instagram no longer
      // holds than a genuinely invalid request.
      return subcode === 2534014 ? 'message_unavailable' : 'invalid_request'
    case 551:
      return 'message_undeliverable'
    default:
      return `instagram_${code}`
  }
}

/**
 * Failures worth surfacing to the agent as something they could act on, rather
 * than as a generic "could not send". Anything not listed is deliberately
 * reported generically: a provider's prose is not our copy, and may name
 * internals.
 */
export const ACTIONABLE_REACTION_ERRORS = new Set([
  'emoji_unsupported',
  'message_unavailable',
  'window_expired',
  'rate_limited',
  'channel_unauthorized',
])
