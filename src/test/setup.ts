import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key')

// jsdom implements `PointerEvent` from v28 on; the old `MouseEvent` stand-in
// only existed because it did not, and it silently drops `pointerType`, which
// hover/touch branches read.
if (typeof PointerEvent === 'undefined') {
  vi.stubGlobal('PointerEvent', MouseEvent)
}

if (typeof Element !== 'undefined') {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
}
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

// --- Notification / Web Push / audio browser API stubs -----------------------
// Notification.permission defaults to 'default'; tests override as needed.
class MockNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn(() => Promise.resolve('granted'))
}
vi.stubGlobal('Notification', MockNotification)
vi.stubGlobal('PushManager', class MockPushManager {})

vi.stubGlobal(
  'BroadcastChannel',
  class MockBroadcastChannel {
    onmessage: ((event: MessageEvent) => void) | null = null
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  },
)

vi.stubGlobal(
  'AudioContext',
  class MockAudioContext {
    currentTime = 0
    destination = {}
    resume = vi.fn(async () => {})
    createOscillator() {
      return {
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: () => ({ connect: vi.fn() }),
        start: vi.fn(),
        stop: vi.fn(),
      }
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: () => ({ connect: vi.fn() }),
      }
    }
  },
)

const mockServiceWorkerRegistration = {
  pushManager: {
    getSubscription: vi.fn(() => Promise.resolve(null)),
    subscribe: vi.fn(),
  },
}
Object.defineProperty(navigator, 'serviceWorker', {
  configurable: true,
  writable: true,
  value: {
    register: vi.fn(() => Promise.resolve(mockServiceWorkerRegistration)),
    ready: Promise.resolve(mockServiceWorkerRegistration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
