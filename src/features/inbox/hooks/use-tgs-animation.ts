import { useQuery } from '@tanstack/react-query'

type TgsAnimationData = Record<string, unknown>

async function fetchTgsAnimation(url: string): Promise<TgsAnimationData> {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Failed to fetch sticker (${res.status})`)
  }
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(stream).text()
  return JSON.parse(text) as TgsAnimationData
}

/**
 * Fetches a Telegram animated sticker (`.tgs` — gzipped Lottie JSON) at the
 * given signed URL, decompresses it natively, and returns the parsed Lottie
 * animation data ready for `lottie-react`.
 *
 * The decompressed JSON is cached indefinitely per URL since storage objects
 * are immutable; React Query GC clears it once the sticker leaves the viewport
 * for long enough.
 */
export function useTgsAnimation(signedUrl: string | null | undefined) {
  const url = signedUrl?.trim() ?? ''
  const enabled = url.length > 0

  return useQuery({
    queryKey: ['tgs-animation', url],
    queryFn: () => fetchTgsAnimation(url),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}
