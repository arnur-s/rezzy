import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  })
}

type RenderWithQueryClientOptions = RenderOptions & {
  queryClient?: QueryClient
}

export function renderWithQueryClient(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...options
  }: RenderWithQueryClientOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return {
    queryClient,
    ...render(ui, {
      wrapper: Wrapper,
      ...options,
    }),
  }
}
