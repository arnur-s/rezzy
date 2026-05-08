import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from '../routeTree.gen'
import { queryClient } from './query-client'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      auth: null,
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
