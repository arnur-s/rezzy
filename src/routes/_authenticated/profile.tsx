import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The profile moved under the account settings shell. Kept as a redirect so
 * existing links and bookmarks still land on it.
 */
export const Route = createFileRoute('/_authenticated/profile')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile' })
  },
})
