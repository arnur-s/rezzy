import {
  sortConversationsByActivity,
} from '@/entities/conversation'
import type { ConversationWithRelations } from '@/entities/conversation'
import { supabase } from '@/utils/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
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
          }
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
        () => {
          // Embedded relations aren't on the raw payload, so refetch the list
          // when a brand new conversation appears.
          void queryClient.invalidateQueries({
            queryKey: key,
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
