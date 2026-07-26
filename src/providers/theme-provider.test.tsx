import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from './theme-provider'

// This environment provides no localStorage; the same Map-backed stub the
// recently-viewed store's tests use stands in for it.
const storageEntries = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return storageEntries.size
  },
  clear() {
    storageEntries.clear()
  },
  getItem(key) {
    return storageEntries.get(key) ?? null
  },
  key(index) {
    return Array.from(storageEntries.keys())[index] ?? null
  },
  removeItem(key) {
    storageEntries.delete(key)
  },
  setItem(key, value) {
    storageEntries.set(key, value)
  },
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})

function ThemeProbe() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setTheme('system')}>
        system
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('starts on the system setting when nothing is stored', () => {
    renderProvider()

    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  // Device-scoped by design: the theme never leaves this browser's storage.
  it('persists an explicit choice to local storage', () => {
    renderProvider()

    fireEvent.click(screen.getByText('dark'))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('restores the stored choice on the next mount', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    renderProvider()

    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('resolved').textContent).toBe('dark')
  })

  it('applies the resolved theme to the document', () => {
    renderProvider()

    fireEvent.click(screen.getByText('dark'))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('stores system as a choice rather than as an absent value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderProvider()

    fireEvent.click(screen.getByText('system'))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system')
    expect(screen.getByTestId('theme').textContent).toBe('system')
    // The stubbed matchMedia reports no dark preference.
    expect(screen.getByTestId('resolved').textContent).toBe('light')
  })

  it('ignores a stored value that is not a theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia')

    renderProvider()

    expect(screen.getByTestId('theme').textContent).toBe('system')
  })
})
