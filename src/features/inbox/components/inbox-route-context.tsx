import type { ConversationWithRelations } from '@/entities/conversation'
import { createContext, useContext } from 'react'

type InboxThreadRouteContextValue = {
  workspaceId: string
  senderId: string | null
  selectedConversation: ConversationWithRelations | null
  selectedConversationId: string | null
  isConversationsPending: boolean
  isConversationsError: boolean
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
