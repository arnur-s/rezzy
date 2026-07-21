import { useMessageNotifications } from '@/features/notifications/hooks/use-message-notifications'
import type { ReactNode } from 'react'

/**
 * Authenticated, workspace-agnostic notification provider. Mounted once in the
 * authenticated layout so message notifications work across every workspace the
 * user belongs to, regardless of the current route. Subscribes to the user's
 * notification records and presents in-app notifications.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  useMessageNotifications()
  return <>{children}</>
}
