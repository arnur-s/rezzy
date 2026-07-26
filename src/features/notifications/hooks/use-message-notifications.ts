import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { useAuth } from '@/providers/auth-provider'
import { supabase } from '@/utils/supabase'
import { useToast } from '@astryxdesign/core/Toast'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { getMessageNotificationDetails } from '../api/notifications'
import { showMessageNotificationToast } from '../components/message-notification'
import type {
  MessageNotificationRow,
  NotificationPreferences,
} from '../model/types'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../model/types'
import { NotificationDeduper } from '../utils/dedupe'
import type { NotificationTarget } from '../utils/notification-navigation'
import { parseNotificationThreadPath } from '../utils/notification-navigation'
import { shouldPresentInApp } from '../utils/should-notify'
import { playNotificationSound, primeNotificationSound } from '../utils/sound'
import { createTabCoordinator } from '../utils/tab-coordinator'
import { useNotificationPreferences } from './use-notification-preferences'

type NotificationContext = {
  preferences: NotificationPreferences
  openWorkspaceId: string | null
  openConversationId: string | null
}

/**
 * The in-app notification engine. Subscribes to the current user's notification
 * records (user-scoped realtime), deduplicates, coordinates across tabs, applies
 * the exact-thread suppression rule, and presents a toast (+ optional sound).
 * Mounted once via the notifications provider — not inside the inbox.
 */
export function useMessageNotifications(): void {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Read by the once-mounted realtime callback; kept current via the ref below.
  const showToast = useToast()
  const showToastRef = useRef(showToast)
  useEffect(() => {
    showToastRef.current = showToast
  }, [showToast])
  const preferencesQuery = useNotificationPreferences()

  const params = useParams({ strict: false })
  const openWorkspaceId = params.id ?? null
  const openConversationId = params.conversationId ?? null

  const preferences = preferencesQuery.data ?? DEFAULT_NOTIFICATION_PREFERENCES

  // Latest context read by the (once-mounted) realtime callback without
  // forcing the subscription to tear down on every route/preference change.
  const contextRef = useRef<NotificationContext>({
    preferences,
    openWorkspaceId,
    openConversationId,
  })
  useEffect(() => {
    contextRef.current = { preferences, openWorkspaceId, openConversationId }
  }, [preferences, openWorkspaceId, openConversationId])

  const goToThread = useRef((target: NotificationTarget) => {
    void navigate({
      to: '/workspaces/$id/inbox/$conversationId',
      params: {
        id: target.workspaceId,
        conversationId: target.conversationId,
      },
    })
  })
  useEffect(() => {
    goToThread.current = (target) => {
      void navigate({
        to: '/workspaces/$id/inbox/$conversationId',
        params: {
          id: target.workspaceId,
          conversationId: target.conversationId,
        },
      })
    }
  }, [navigate])

  // Resume the audio context on the first user gesture (autoplay policy).
  useEffect(() => {
    primeNotificationSound()
  }, [])

  // Service worker -> client navigation (focus existing tab, route in-app).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: string } | undefined
      if (data?.type === 'notification-navigate' && data.path) {
        const target = parseNotificationThreadPath(data.path)
        if (target) goToThread.current(target)
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler)
    }
  }, [])

  // The user-scoped realtime subscription (mounted once per user).
  useEffect(() => {
    if (!userId) return

    const deduper = new NotificationDeduper()
    const coordinator = createTabCoordinator()

    const present = async (row: MessageNotificationRow) => {
      if (!deduper.add(row.id)) return
      const ctx = contextRef.current
      // Page Visibility alone isn't enough — a tab stays "visible" while the
      // user has switched to another application. Require actual OS focus too,
      // so we don't show a toast the user can't see (and correctly defer to
      // the service worker's OS notification instead, which checks the same
      // thing via WindowClient.focused).
      const isFocused =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        document.hasFocus()

      const show = shouldPresentInApp({
        inAppEnabled: ctx.preferences.inAppEnabled,
        isFocused,
        openWorkspaceId: ctx.openWorkspaceId,
        openConversationId: ctx.openConversationId,
        notification: row,
      })
      if (!show) return
      // Only one tab presents a given notification.
      if (!coordinator.claim(row.id)) return

      const details = await getMessageNotificationDetails(row)
      if (!details) return

      showMessageNotificationToast({
        details,
        previewMode: ctx.preferences.previewMode,
        onOpen: (target) => goToThread.current(target),
        showToast: showToastRef.current,
      })

      if (ctx.preferences.soundEnabled) playNotificationSound()
    }

    // Keeps the header bell live for workspaces the agent is not viewing. The
    // active workspace already has useConversationsRealtime merging its rows,
    // so re-fetching its list here would only duplicate that work.
    const syncUnreadCaches = (row: MessageNotificationRow) => {
      if (row.workspace_id === contextRef.current.openWorkspaceId) return
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.unreadCountsForWorkspace(row.workspace_id),
      })
      void queryClient.invalidateQueries({
        queryKey: inboxQueryKeys.conversations(row.workspace_id),
      })
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as MessageNotificationRow
          // Cache sync is independent of the toast rules (dedupe, tab
          // coordination, thread suppression) that can skip presentation.
          syncUnreadCaches(row)
          void present(row)
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[notifications] realtime subscription status', status)
        }
      })

    return () => {
      coordinator.destroy()
      void supabase.removeChannel(channel)
    }
  }, [userId, queryClient])
}
