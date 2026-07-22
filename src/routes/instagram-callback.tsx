import { INSTAGRAM_OAUTH_MESSAGE_TYPE } from '@/features/channels/lib/instagram-oauth'
import { m } from '@/paraglide/messages'
import { Spinner } from '@heroui/react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

type InstagramCallbackSearch = {
  code?: string
  state?: string
  error?: string
  error_reason?: string
  error_description?: string
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const Route = createFileRoute('/instagram-callback')({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>,
  ): InstagramCallbackSearch => ({
    code: readString(search.code),
    state: readString(search.state),
    error: readString(search.error),
    error_reason: readString(search.error_reason),
    error_description: readString(search.error_description),
  }),
})

/**
 * Runs inside the OAuth popup. It hands the authorization result back to the
 * opener via a same-origin postMessage, then closes itself. No secrets are
 * handled here — the code is exchanged server-side by instagram-connect-channel.
 */
function RouteComponent() {
  const search = Route.useSearch()

  useEffect(() => {
    const opener = window.opener as Window | null
    if (opener) {
      opener.postMessage(
        {
          type: INSTAGRAM_OAUTH_MESSAGE_TYPE,
          code: search.code ?? null,
          state: search.state ?? null,
          error: search.error ?? search.error_reason ?? null,
        },
        window.location.origin,
      )
    }
    const timer = window.setTimeout(() => {
      try {
        window.close()
      } catch {
        /* ignore */
      }
    }, 150)
    return () => window.clearTimeout(timer)
  }, [search])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <Spinner />
      <div>
        <p className="text-base font-medium">{m.instagram_callback_title()}</p>
        <p className="mt-1 text-sm text-muted">{m.instagram_callback_body()}</p>
      </div>
    </div>
  )
}
