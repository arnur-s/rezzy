/* Notification service worker: Web Push display + notification-click routing.
   Kept dependency-free and framework-agnostic. Message previews are already
   redacted server-side per the recipient's preview mode before they reach here. */
/* eslint-disable */
/* global self, clients */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    payload = {}
  }

  const title = payload.title || 'New message'
  const body = payload.body || ''
  const conversationId = payload.conversationId
  const workspaceId = payload.workspaceId
  const notificationId = payload.notificationId

  event.waitUntil(
    (async () => {
      // If any app window is focused, the in-app path handles it — skip the OS
      // notification so a message is never delivered twice. Use `focused`
      // (actual OS-level window focus), not `visibilityState`: a tab stays
      // "visible" while the user has alt-tabbed to another app, which would
      // otherwise suppress the OS notification for a message nobody sees.
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const hasFocusedClient = windowClients.some((client) => client.focused)
      if (hasFocusedClient) return

      await self.registration.showNotification(title, {
        body,
        // Group/replace repeated notifications for the same conversation.
        tag: conversationId || notificationId || 'message',
        renotify: true,
        data: { conversationId, workspaceId, notificationId },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const conversationId = data.conversationId
  const workspaceId = data.workspaceId
  if (!conversationId || !workspaceId) return

  const path =
    '/workspaces/' +
    encodeURIComponent(workspaceId) +
    '/inbox/' +
    encodeURIComponent(conversationId)

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Prefer focusing an existing tab and routing it in-app (no reload).
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus()
          client.postMessage({ type: 'notification-navigate', path })
          return
        }
      }
      // Otherwise open a new tab deep-linked to the thread.
      if (self.clients.openWindow) {
        await self.clients.openWindow(path)
      }
    })(),
  )
})
