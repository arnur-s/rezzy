import { useToast } from '@astryxdesign/core/Toast'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppLayerProvider } from './app-layer-provider'

function ToastTrigger() {
  const showToast = useToast()

  return (
    <button onClick={() => showToast({ body: 'Boom', type: 'error' })}>
      raise
    </button>
  )
}

/**
 * jsdom implements no part of the popover API, so the viewport's real
 * promotion is a no-op there. Stubbing `togglePopover` onto the element lets
 * the wiring be asserted; the top-layer ordering it buys can only be seen in a
 * real browser.
 */
function stubPopover(element: HTMLElement) {
  const togglePopover = vi.fn()
  Object.assign(element, { togglePopover })
  return togglePopover
}

function renderProvider() {
  render(
    <AppLayerProvider>
      <ToastTrigger />
    </AppLayerProvider>,
  )

  const viewport = document.querySelector<HTMLElement>(
    '[popover="manual"][role="region"]',
  )
  if (!viewport) throw new Error('toast viewport was not rendered')

  return { viewport, togglePopover: stubPopover(viewport) }
}

describe('AppLayerProvider', () => {
  it('re-promotes the toast viewport when a toast is raised', async () => {
    const { togglePopover } = renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'raise' }))

    // Hide then show: the CSS top layer is ordered by promotion time, so only
    // a fresh promotion moves the viewport above an already-open modal.
    await waitFor(() => {
      expect(togglePopover.mock.calls).toEqual([[false], [true]])
    })
  })

  it('re-promotes when another layer opens over a visible toast', async () => {
    const { viewport, togglePopover } = renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'raise' }))
    await waitFor(() => expect(viewport.childElementCount).toBe(1))
    togglePopover.mockClear()

    const dialog = document.createElement('dialog')
    document.body.append(dialog)
    fireEvent(dialog, new Event('toggle'))

    expect(togglePopover.mock.calls).toEqual([[false], [true]])
  })

  it('ignores its own promotion toggles', () => {
    const { viewport, togglePopover } = renderProvider()

    fireEvent(viewport, new Event('toggle'))

    expect(togglePopover).not.toHaveBeenCalled()
  })
})
