type ScrollContainer = Pick<
  HTMLElement,
  'clientHeight' | 'scrollHeight' | 'scrollTop'
>

export function isNearBottom(
  container: ScrollContainer,
  threshold = 120,
): boolean {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    threshold
  )
}
