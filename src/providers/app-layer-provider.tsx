import { LayerProvider } from '@astryxdesign/core/Layer'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

/**
 * Astryx's `ToastViewport` is the only element it renders as a manual popover
 * with `role="region"`: `Carousel` uses the role without a popover, and the
 * manual popovers `useLayer` creates carry no role.
 */
const TOAST_VIEWPORT_SELECTOR = '[popover="manual"][role="region"]'

/**
 * Re-promote the toast viewport to the front of the CSS top layer.
 *
 * Hiding and re-showing within one task is safe: the browser never recomputes
 * style in between, so an in-flight toast enter/exit transition still runs to
 * its `transitionend` (which is what removes an exiting toast from the list),
 * and focus inside the viewport is preserved.
 *
 * jsdom implements no part of the popover API, so this no-ops under test the
 * same way `ToastViewport`'s own promotion does.
 */
function promoteToastViewport(viewport: HTMLElement) {
  if (typeof viewport.togglePopover !== 'function') return

  viewport.togglePopover(false)
  viewport.togglePopover(true)
}

/**
 * Keep toasts painted above modals.
 *
 * `ToastViewport` promotes itself to the top layer once, when `LayerProvider`
 * mounts. `Dialog` promotes with `showModal()` when it opens — later — and the
 * top layer is ordered by promotion time rather than by `z-index`, so an open
 * modal and its `::backdrop` cover a viewport promoted at app start: a toast
 * raised from inside a modal (a failed "create workspace", say) was invisible.
 * No `z-index` can reach across the top layer, so the viewport has to be
 * promoted again instead.
 *
 * Note this restores visibility, not interactivity: `showModal()` marks
 * everything outside the dialog inert, so a toast shown over an open modal
 * cannot be clicked away until the modal closes. Auto-hiding toasts still
 * expire on their own timer.
 */
function useToastViewportOnTop() {
  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>(
      TOAST_VIEWPORT_SELECTOR,
    )
    if (!viewport) return

    // A toast is raised while something else already owns the top layer.
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes.length > 0)) {
        promoteToastViewport(viewport)
      }
    })
    observer.observe(viewport, { childList: true })

    // The reverse order: a dialog, menu, or popover opens over a toast that is
    // already showing. `toggle` does not bubble, so listen in the capture
    // phase, and ignore the viewport's own toggles from the promotion above.
    const handleToggle = (event: Event) => {
      if (event.target === viewport || viewport.childElementCount === 0) return
      promoteToastViewport(viewport)
    }
    document.addEventListener('toggle', handleToggle, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('toggle', handleToggle, true)
    }
  }, [])
}

/**
 * Astryx's `LayerProvider` — which mounts the toast viewport — plus the fix
 * that keeps toasts visible above modals. See {@link useToastViewportOnTop}.
 */
export function AppLayerProvider({ children }: { children: ReactNode }) {
  useToastViewportOnTop()

  return <LayerProvider>{children}</LayerProvider>
}
