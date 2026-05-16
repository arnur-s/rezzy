import { useEffect, useRef, type RefObject } from 'react'

type Options = {
  rootRef: RefObject<HTMLElement | null>
  hasMoreOlder: boolean
  isFetchingOlder: boolean
  onLoadOlder: () => void
  enabled?: boolean
}

export function useLoadOlderMessagesSentinel({
  rootRef,
  hasMoreOlder,
  isFetchingOlder,
  onLoadOlder,
  enabled = true,
}: Options) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const onLoadOlderRef = useRef(onLoadOlder)

  useEffect(() => {
    onLoadOlderRef.current = onLoadOlder
  })

  useEffect(() => {
    const root = rootRef.current
    const sentinel = sentinelRef.current
    if (!enabled || !root || !sentinel || !hasMoreOlder) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingOlder) {
          onLoadOlderRef.current()
        }
      },
      { root, rootMargin: '200px 0px 0px 0px', threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [enabled, hasMoreOlder, isFetchingOlder, rootRef])

  return sentinelRef
}
