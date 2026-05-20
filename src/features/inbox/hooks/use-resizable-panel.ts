import { useCallback, useEffect, useRef, useState } from 'react'

type Options = {
  storageKey: string
  defaultWidth: number
  min: number
  max: number
}

type Return = {
  width: number
  handleMouseDown: (e: React.MouseEvent) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function readStored(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  if (raw === null) return fallback
  const parsed = parseInt(raw, 10)
  return isNaN(parsed) ? fallback : parsed
}

export function useResizablePanel({ storageKey, defaultWidth, min, max }: Options): Return {
  const [width, setWidth] = useState(() => readStored(storageKey, defaultWidth))

  const dragState = useRef<{ startX: number; startWidth: number } | null>(null)

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.current) return
      const newWidth = clamp(
        dragState.current.startWidth + (e.clientX - dragState.current.startX),
        min,
        max,
      )
      setWidth(newWidth)
    },
    [min, max],
  )

  const onMouseUp = useCallback(() => {
    if (!dragState.current) return
    dragState.current = null
    setWidth((w) => {
      localStorage.setItem(storageKey, String(w))
      return w
    })
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }, [storageKey, onMouseMove])

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragState.current = { startX: e.clientX, startWidth: width }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [width, onMouseMove, onMouseUp],
  )

  return { width, handleMouseDown }
}
