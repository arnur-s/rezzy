import { NotificationSettings } from '@/features/notifications'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  component: NotificationSettings,
})
