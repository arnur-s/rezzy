import { SecurityPage } from '@/features/account'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/security')({
  component: SecurityPage,
})
