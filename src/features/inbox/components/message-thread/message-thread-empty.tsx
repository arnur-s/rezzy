import { m } from '@/paraglide/messages'
import { InboxIcon, MessageCircleIcon } from 'lucide-react'

type Props = {
  /**
   * True when the conversation list beside this pane has nothing in it.
   *
   * The pane used to say "Pick a conversation" unconditionally, which asks the
   * reader to choose from an empty list and leaves them looking for the control
   * that would let them. With no conversations the honest message is that none
   * have arrived, and where they will come from.
   */
  hasNoConversations?: boolean
}

export function MessageThreadEmpty({ hasNoConversations = false }: Props) {
  const Icon = hasNoConversations ? MessageCircleIcon : InboxIcon

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
        <Icon className="size-8" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-primary">
        {hasNoConversations
          ? m.inbox_empty_no_conversations_title()
          : m.inbox_empty_select_conversation_title()}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-primary/60">
        {hasNoConversations
          ? m.inbox_empty_no_conversations_description()
          : m.inbox_empty_select_conversation_description()}
      </p>
    </div>
  )
}
