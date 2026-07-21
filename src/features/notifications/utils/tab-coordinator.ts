/**
 * Cross-tab coordination so a single notification event produces at most one
 * in-app toast / sound across all of a user's open tabs. Uses the native
 * BroadcastChannel API — no extra dependency. When BroadcastChannel is
 * unavailable the coordinator degrades to single-tab behaviour (always claims).
 *
 * "First tab to claim wins": a tab claims an id only when it itself would
 * present it (visible + not viewing the exact thread), so a tab that suppresses
 * never blocks another tab from presenting.
 */

type CoordinatorMessage = { type: 'claimed'; id: string }

const CHANNEL_NAME = 'rezzy:notifications'
const CLAIM_TTL_MS = 60_000

export type TabCoordinator = {
  claim: (id: string) => boolean
  destroy: () => void
}

function isCoordinatorMessage(value: unknown): value is CoordinatorMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'claimed' &&
    typeof (value as { id?: unknown }).id === 'string'
  )
}

export function createTabCoordinator(): TabCoordinator {
  const claimed = new Map<string, number>()

  const prune = () => {
    const cutoff = Date.now() - CLAIM_TTL_MS
    for (const [id, at] of claimed) {
      if (at < cutoff) claimed.delete(id)
    }
  }

  let channel: BroadcastChannel | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (event: MessageEvent<unknown>) => {
        if (isCoordinatorMessage(event.data)) {
          claimed.set(event.data.id, Date.now())
        }
      }
    } catch {
      channel = null
    }
  }

  return {
    claim(id) {
      prune()
      if (claimed.has(id)) return false
      claimed.set(id, Date.now())
      channel?.postMessage({ type: 'claimed', id } satisfies CoordinatorMessage)
      return true
    },
    destroy() {
      channel?.close()
      channel = null
      claimed.clear()
    },
  }
}
