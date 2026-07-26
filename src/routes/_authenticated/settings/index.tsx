import { createFileRoute, redirect } from '@tanstack/react-router'

/** The account area opens on identity; the preferences follow it. */
export const Route = createFileRoute('/_authenticated/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile' })
  },
})
