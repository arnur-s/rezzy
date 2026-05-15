type ScrollContainer = Pick<
  HTMLElement,
  'clientHeight' | 'scrollHeight' | 'scrollTop'
>

export function isNearBottom(
  container: ScrollContainer,
  threshold = 80,
): boolean {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    threshold
  )
}

/**
 * After prepending content above the viewport, restore the user's scroll offset
 * so the same messages stay in view (e.g. older page load in chat).
 */
export function preserveScrollTopAfterContentGrowth({
  previousScrollHeight,
  previousScrollTop,
  newScrollHeight,
}: {
  previousScrollHeight: number
  previousScrollTop: number
  newScrollHeight: number
}): number {
  return newScrollHeight - previousScrollHeight + previousScrollTop
}

/**
 * Run `scroll` on the next frame, then invoke `then` after two more frames so
 * layout / scrollTop updates are applied (e.g. before gated mark-read).
 */
export function runAfterScrollLayout(scroll: () => void, then: () => void): void {
  requestAnimationFrame(() => {
    scroll()
    requestAnimationFrame(() => {
      requestAnimationFrame(then)
    })
  })
}
