import { useRouter } from '@tanstack/react-router'
import type { ComponentPropsWithoutRef, MouseEvent, Ref } from 'react'

export interface RouterLinkProps extends ComponentPropsWithoutRef<'a'> {
  ref?: Ref<HTMLAnchorElement>
}

function isModifiedEvent(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
}

/**
 * Link adapter for Astryx's LinkProvider: renders a real anchor (so
 * open-in-new-tab and copy-link work) but performs TanStack Router SPA
 * navigation for same-origin hrefs instead of a full page load.
 */
export function RouterLink({
  ref,
  href,
  target,
  onClick,
  children,
  ...rest
}: RouterLinkProps) {
  const router = useRouter()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      isModifiedEvent(event) ||
      (target && target !== '_self') ||
      !href?.startsWith('/')
    ) {
      return
    }
    event.preventDefault()
    router.history.push(href)
  }

  return (
    <a ref={ref} href={href} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
