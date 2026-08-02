import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { useCallback, useEffect, useRef } from 'react'

/** Matches the platform press-and-hold delay on iOS and Android. */
const LONG_PRESS_MS = 450
/** Past this much travel the gesture is a scroll, not a press. */
const MOVE_TOLERANCE_PX = 10

type Options = {
  onLongPress: () => void
  /** Skip arming the timer entirely (e.g. nothing to open). */
  isEnabled?: boolean
}

/**
 * Press-and-hold on touch only.
 *
 * Mouse and pen are deliberately excluded: a pointer that can hover already has
 * a cheaper affordance, and arming the timer on mouse-down turns an ordinary
 * click-and-think into a surprise menu.
 *
 * The returned handlers also swallow the tail of a fired press — the
 * `contextmenu` the platform raises at its own threshold, and the synthetic
 * `click` that follows `touchend` — so holding a message cannot simultaneously
 * open the browser's callout or activate a link inside it.
 */
export function useLongPress({ onLongPress, isEnabled = true }: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const isTouchRef = useRef(false)
  const hasFiredRef = useRef(false)
  const onLongPressRef = useRef(onLongPress)

  useEffect(() => {
    onLongPressRef.current = onLongPress
  })

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    originRef.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      isTouchRef.current = event.pointerType === 'touch'
      if (!isEnabled || !isTouchRef.current) return
      cancel()
      hasFiredRef.current = false
      originRef.current = { x: event.clientX, y: event.clientY }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        originRef.current = null
        hasFiredRef.current = true
        onLongPressRef.current()
      }, LONG_PRESS_MS)
    },
    [cancel, isEnabled],
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const origin = originRef.current
      if (!origin) return
      if (
        Math.abs(event.clientX - origin.x) > MOVE_TOLERANCE_PX ||
        Math.abs(event.clientY - origin.y) > MOVE_TOLERANCE_PX
      ) {
        cancel()
      }
    },
    [cancel],
  )

  const onContextMenu = useCallback((event: ReactMouseEvent) => {
    // Only touch: a right-click on desktop still gets the browser's own menu.
    if (isTouchRef.current) event.preventDefault()
  }, [])

  const onClickCapture = useCallback((event: ReactMouseEvent) => {
    if (!hasFiredRef.current) return
    hasFiredRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu,
    onClickCapture,
  }
}
