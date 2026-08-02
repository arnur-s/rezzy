import type { MessageReactionRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { supabase } from '@/utils/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { PresentableError } from '../utils/presentable-error'

/**
 * Active (non-removed) reactions for a conversation, keyed by message id in
 * the hook layer. Removed rows are audit history and never rendered.
 */
export async function getConversationReactions(
  conversationId: string,
): Promise<Array<MessageReactionRow>> {
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('action', 'added')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }
  return data
}

/**
 * The canonical outbound reaction command. `emoji: null` removes whatever this
 * workspace is holding on the message; every supported provider expresses
 * removal as the empty reaction, so a separate command would be unwrapped again
 * at the boundary.
 *
 * The browser deliberately names the *message*, not the provider: resolving the
 * channel, its credentials, and the provider payload is the edge function's
 * job, and channel secrets never reach the client.
 */
export type SendReactionCommand = {
  messageId: string
  emoji: string | null
}

/**
 * Codes the edge function returns in place of provider prose. A provider's own
 * error text can name internals and is never localized, so the wire carries a
 * stable code and the copy is chosen here.
 */
const REACTION_ERROR_COPY: Record<string, () => string> = {
  emoji_unsupported: () => m.inbox_reaction_error_emoji(),
  message_unavailable: () => m.inbox_reaction_error_message(),
  missing_provider_id: () => m.inbox_reaction_unavailable_pending(),
  window_expired: () => m.inbox_reaction_error_window(),
  rate_limited: () => m.inbox_reaction_error_rate_limited(),
  channel_disconnected: () => m.inbox_reaction_error_channel(),
  channel_unauthorized: () => m.inbox_reaction_error_channel(),
  reactions_unsupported: () => m.inbox_reaction_error_emoji(),
}

/**
 * Turns an invoke failure into something sayable. An unmapped code falls back
 * to the generic sentence rather than leaking a provider string: a code we did
 * not plan for is, by definition, one whose wording we have not reviewed.
 */
async function mapReactionInvokeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    let code: string | undefined
    try {
      const body = (await response.clone().json()) as { code?: string }
      code = body.code
    } catch {
      /* Non-JSON body: fall through to the generic message. */
    }
    const copy = code ? REACTION_ERROR_COPY[code] : undefined
    return new PresentableError(copy ? copy() : m.inbox_reaction_error_generic())
  }
  return new PresentableError(m.inbox_reaction_error_generic())
}

/**
 * Sends, replaces, or withdraws this workspace's reaction through the trusted
 * edge function. Resolves only once the provider has accepted it, so the caller
 * can treat resolution as confirmation and rejection as a reason to roll back.
 */
export async function sendMessageReaction({
  messageId,
  emoji,
}: SendReactionCommand): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean }>(
    'send-reaction',
    { body: { messageId, emoji } },
  )

  if (error) {
    throw await mapReactionInvokeError(error)
  }
  if (!data?.ok) {
    throw new PresentableError(m.inbox_reaction_error_generic())
  }
}
