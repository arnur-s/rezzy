/**
 * Bounded FIFO set that dedupes notification ids seen within a single tab.
 * Guards against realtime reconnections, query refetches, repeated provider
 * renders, optimistic updates, and reloads all surfacing the same record.
 */
export class NotificationDeduper {
  private readonly seen = new Set<string>()
  private readonly order: Array<string> = []

  constructor(private readonly max = 500) {}

  /** Record `id`; returns true when it is new, false when already seen. */
  add(id: string): boolean {
    if (this.seen.has(id)) return false
    this.seen.add(id)
    this.order.push(id)
    if (this.order.length > this.max) {
      const oldest = this.order.shift()
      if (oldest !== undefined) this.seen.delete(oldest)
    }
    return true
  }

  has(id: string): boolean {
    return this.seen.has(id)
  }

  clear(): void {
    this.seen.clear()
    this.order.length = 0
  }
}
