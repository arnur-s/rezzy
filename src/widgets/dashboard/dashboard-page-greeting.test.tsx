import { setLocale } from '@/paraglide/runtime'
import { m } from '@/paraglide/messages'
import { createTestQueryClient } from '@/test/render'
import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountQueryKeys } from '@/features/account'
import type { UserProfile } from '@/features/account'
import { DashboardPage } from './dashboard-page'

const USER_ID = 'u1'

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/utils/supabase', () => ({ supabase: supabaseMock }))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => options,
    useNavigate: () => vi.fn(),
    Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  }
})

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: USER_ID,
      email: 'kim@example.com',
      user_metadata: { full_name: 'Old Signup Name' },
    },
  }),
}))

vi.mock('@/features/workspaces/components/create-workspace-modal', () => ({
  CreateWorkspaceModal: () => null,
}))

const WORKSPACE = {
  id: 'w1',
  name: 'Acme Sales',
  description: null,
  icon: null,
  is_main: true,
  created_at: '',
  created_by: USER_ID,
  updated_at: '',
  updated_by: null,
  deleted_at: null,
}

function builder(rows: Array<unknown>) {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const key of [
    'select',
    'eq',
    'in',
    'is',
    'not',
    'or',
    'order',
    'limit',
    'gte',
    'lte',
    'lt',
    'gt',
    'neq',
  ]) {
    chain[key] = vi.fn(self)
  }
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: rows, error: null, count: rows.length })
  return chain
}

function renderHome(seeded?: UserProfile) {
  const queryClient = createTestQueryClient()

  if (seeded) {
    queryClient.setQueryData(accountQueryKeys.profile(USER_ID), seeded)
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

function profile(): UserProfile {
  return {
    id: USER_ID,
    fullName: 'Augusta King',
    email: 'kim@example.com',
    avatarUrl: null,
    jobTitle: null,
    phone: null,
    timezone: null,
    language: 'auto',
  }
}

/**
 * The greeting is correct in isolation and still has to actually reach the
 * page. Deleting it from the header broke no test, because every home-page
 * test asserts on the summary and the attention list instead — so the header
 * could have been dropped in a refactor and nothing would have said so.
 */
describe('home page greeting wiring', () => {
  beforeEach(() => {
    setLocale('en', { reload: false })
    supabaseMock.from.mockReset()
    supabaseMock.rpc.mockReset()
    supabaseMock.rpc.mockReturnValue(builder([]))
    supabaseMock.from.mockImplementation((table: string) =>
      builder(table === 'workspaces' ? [WORKSPACE] : []),
    )
  })

  it('renders the greeting on the page, addressed by the saved name', async () => {
    renderHome(profile())

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toContain('Augusta King')
    expect(heading.textContent).not.toContain('Old Signup Name')
  })

  it('still greets from auth metadata before the profile row lands', async () => {
    renderHome()

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1 }).textContent,
      ).toContain('Old Signup Name')
    })
  })

  it('offers the direct inbox door when there is exactly one workspace', async () => {
    renderHome(profile())

    await waitFor(() => {
      expect(screen.getByText(m.home_open_inbox())).toBeTruthy()
    })
  })
})
