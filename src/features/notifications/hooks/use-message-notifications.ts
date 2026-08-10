import { dashboardQueryKeys } from '@/features/dashboard/api/dashboard-stats'
import { inboxQueryKeys } from '@/features/inbox/api/query-keys'
import { listMyInvitations } from '@/features/workspaces/api/workspace-membership'
import { workspaceQueryKeys } from '@/features/workspaces/api/workspaces'
import { useAuth } from '@/providers/auth-provider'
import { supabase } from '@/utils/supabase'
import { useToast } from '@astryxdesign/core/Toast'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { getMessageNotificationDetails } from '../api/notifications'
import {
  findInvitationWorkspaceName,
  invitationPresentationKey,
  shouldPresentInvitation,
  showInvitationNotificationToast,
} from '../components/invitation-notification'
import { showMessageNotificationToast } from '../components/message-notification'
import type {
  MessageNotificationRow,
  NotificationPreferences,
  WorkspaceInvitationRow,
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

  // Where an accepted invitation's toast sends the invitee: into the
  // workspace they just joined. No exact-thread analog applies here, so
  // unlike goToThread there is nothing to suppress against.
  const goToWorkspace = useRef((workspaceId: string) => {
    void navigate({
      to: '/workspaces/$id',
      params: { id: workspaceId },
    })
  })
  useEffect(() => {
    goToWorkspace.current = (workspaceId) => {
      void navigate({
        to: '/workspaces/$id',
        params: { id: workspaceId },
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

    // Mirrors `present` above, but for invitations: no `shouldPresentInApp` —
    // that function's exact-thread suppression is meaningless for an
    // invitation, which is not tied to any open conversation. It does hydrate,
    // same as `present` awaits getMessageNotificationDetails: the row carries
    // workspace_id but not the workspace's name, which the invitee cannot
    // read directly (RLS on public.workspaces is member-only).
    const presentInvitation = async (row: WorkspaceInvitationRow) => {
      const key = invitationPresentationKey(row)
      if (!deduper.add(key)) return
      const ctx = contextRef.current
      const isFocused =
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        document.hasFocus()

      if (!ctx.preferences.inAppEnabled || !isFocused) return
      // Only one tab presents a given invitation event.
      if (!coordinator.claim(key)) return

      // list_my_workspace_invitations is the same RPC InvitationResponseDialog
      // already reads for this exact decision. fetchQuery (rather than a bare
      // call) dedupes against the refetch the invalidate above already kicked
      // off on this same key for every mounted useMyInvitations observer
      // (the switcher renders one app-wide), so this costs no extra round
      // trip in the common case. A rejected fetch is treated as a hydration
      // miss, not a reason to skip the toast — see workspaceName below.
      const invitations = await queryClient
        .fetchQuery({
          queryKey: workspaceQueryKeys.myInvitations,
          queryFn: listMyInvitations,
        })
        .catch(() => null)
      const workspaceName = findInvitationWorkspaceName(invitations, row.id)

      showInvitationNotificationToast({
        row,
        workspaceName,
        showToast: showToastRef.current,
        onOpen: (workspaceId) => goToWorkspace.current(workspaceId),
      })

      if (ctx.preferences.soundEnabled) playNotificationSound()
    }

    // Keeps the header bell live for workspaces the agent is not viewing. The
    // active workspace already has useConversationsRealtime merging its rows,
    // so re-fetching its list here would only duplicate that work.
    const syncUnreadCaches = (row: MessageNotificationRow) => {
      // Home aggregates across every workspace, so a new message changes its
      // counts wherever it landed — including the workspace currently open,
      // whose early return below covers only the inbox's own caches.
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all })

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
      .on(
        'postgres_changes',
        {
          // INSERT *and* UPDATE. A re-invite is the ON CONFLICT DO UPDATE
          // branch of invite_workspace_member, so binding INSERT alone would
          // leave the one case where an admin tries again — because the first
          // attempt went unnoticed — notifying nobody.
          event: '*',
          schema: 'public',
          table: 'workspace_invitations',
          filter: `invited_user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          // The realtime payload is typed `{ [key: string]: any }` by
          // supabase-js; this is the trusted boundary where that gets narrowed
          // to the table's generated row type, same as the message branch above.
          const row = payload.new as WorkspaceInvitationRow

          if (!shouldPresentInvitation(row)) return

          void queryClient.invalidateQueries({
            queryKey: workspaceQueryKeys.myInvitations,
          })
          void presentInvitation(row)
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
