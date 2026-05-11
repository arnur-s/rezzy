import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')

vi.stubGlobal('PointerEvent', MouseEvent)
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

vi.stubGlobal(
  'IntersectionObserver',
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
