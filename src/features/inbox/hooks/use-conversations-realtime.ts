import {
  sortConversationsByActivity,
} from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { supabase } from '@/utils/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getConversationById } from '../api/conversations'
import { inboxQueryKeys } from '../api/query-keys'

/**
 * Subscribes to INSERT / UPDATE / DELETE on conversations for the active workspace
 * and keeps the TanStack Query cache aligned with the server sort order.
 */
export function useConversationsRealtime(workspaceId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!workspaceId) return

    const key = inboxQueryKeys.conversations(workspaceId)

    const channel = supabase
      .channel(`inbox:conversations:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const next = payload.new as Partial<ConversationWithRelations> & {
            id: string
            deleted_at?: string | null
          }

          // An archived conversation arrives as an UPDATE, not a DELETE, and
          // merging it would leave a hidden row in the list that 404s when
          // opened. `postgres_changes` filters cannot express `deleted_at is
          // null` — they take one column and `workspace_id` already holds it —
          // so the exclusion happens here.
          //
          // This only fires for subscribers who can still see the row, which in
          // practice means the admin who archived it: Supabase evaluates RLS per
          // subscriber, and the updated row is invisible to everyone else, so
          // they receive no event at all and keep a stale row until the next
          // refetch. The archiving client also invalidates this key directly
          // (`useArchiveContact`), and a member who opens a stale row lands on
          // the existing "conversation unavailable" state.
          if (next.deleted_at) {
            queryClient.setQueryData<Array<ConversationWithRelations>>(
              key,
              (current) => current?.filter((row) => row.id !== next.id),
            )
            void queryClient.invalidateQueries({
              queryKey: inboxQueryKeys.unreadCountsForWorkspace(workspaceId),
            })
            return
          }

          // The other direction: an inbound message from an archived contact
          // clears deleted_at, so the row becomes visible and this is the first
          // event the client has ever seen for it. It is not in the cache, and a
          // merge over the existing rows would silently drop the conversation
          // that just came back to life. Fetched and inserted like a genuinely
          // new one, because from this client's point of view it is.
          const cached =
            queryClient.getQueryData<Array<ConversationWithRelations>>(key)

          if (cached && !cached.some((row) => row.id === next.id)) {
            void getConversationById(next.id).then((conversation) => {
              if (!conversation) return
              queryClient.setQueryData<Array<ConversationWithRelations>>(
                key,
                (current) => {
                  if (!current) return [conversation]
                  if (current.some((row) => row.id === conversation.id))
                    return current
                  return sortConversationsByActivity([
                    conversation,
                    ...current,
                  ])
                },
              )
            })
          } else {
            queryClient.setQueryData<Array<ConversationWithRelations>>(
              key,
              (current) => {
                const mapped =
                  current?.map((row) =>
                    row.id === next.id ? { ...row, ...next } : row,
                  ) ?? current
                return mapped ? sortConversationsByActivity(mapped) : mapped
              },
            )
          }

          // A new inbound message bumps the conversation row; refresh the
          // caller's per-agent unread counts.
          void queryClient.invalidateQueries({
            queryKey: inboxQueryKeys.unreadCountsForWorkspace(workspaceId),
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const inserted = payload.new as { id?: string }
          if (!inserted.id) return

          void getConversationById(inserted.id).then((conversation) => {
            if (!conversation) return
            queryClient.setQueryData<Array<ConversationWithRelations>>(
              key,
              (current) => {
                if (!current) return [conversation]
                if (current.some((row) => row.id === conversation.id))
                  return current
                return sortConversationsByActivity([conversation, ...current])
              },
            )
          })
          void queryClient.invalidateQueries({
            queryKey: inboxQueryKeys.unreadCountsForWorkspace(workspaceId),
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const removed = payload.old as { id?: string }
          const id = removed.id
          if (!id) return
          queryClient.setQueryData<Array<ConversationWithRelations>>(
            key,
            (current) => current?.filter((row) => row.id !== id),
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [workspaceId, queryClient])
}
