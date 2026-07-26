import { AppearanceSettings } from '@/features/preferences'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/settings/appearance')({
  component: AppearanceSettings,
})
