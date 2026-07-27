import type { ConversationWithRelations } from '@/entities/conversation'
import { createContext, useContext } from 'react'

type InboxThreadRouteContextValue = {
  workspaceId: string
  senderId: string | null
  selectedConversation: ConversationWithRelations | null
  selectedConversationId: string | null
  isConversationsPending: boolean
  isConversationsError: boolean
  /**
   * True once the list has loaded and holds nothing. The empty thread pane
   * uses it to stop inviting a choice from an empty list.
   */
  hasNoConversations: boolean
  onBackToList: () => void
  onToggleContactPanel: () => void
  /** Bumped when the user re-selects the already-open conversation. */
  scrollToLatestNonce: number
}

const InboxThreadRouteContext =
  createContext<InboxThreadRouteContextValue | null>(null)

export const InboxThreadRouteContextProvider = InboxThreadRouteContext.Provider

export function useInboxThreadRouteContext() {
  const context = useContext(InboxThreadRouteContext)

  if (!context) {
    throw new Error(
      'useInboxThreadRouteContext must be used within InboxThreadRouteContextProvider',
    )
  }

  return context
}

export type { InboxThreadRouteContextValue }
