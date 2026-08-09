import { NotificationsPage } from '@/features/notifications'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/notifications')({
  component: NotificationsPage,
})
