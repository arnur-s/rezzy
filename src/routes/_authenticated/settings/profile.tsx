import { ProfilePage } from '@/features/account'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: ProfilePage,
})
