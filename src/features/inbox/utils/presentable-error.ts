/**
 * An error whose `message` is safe to show to the user verbatim — it has
 * already been translated and phrased for a person (channel inactive, a
 * provider rejection surfaced by our own edge function, and so on).
 *
 * Everything else — raw Postgres messages, network failures, unexpected
 * shapes — should stay out of the UI. Callers show a curated fallback for any
 * error that is not a `PresentableError` and log the original for debugging.
 */
export class PresentableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PresentableError'
  }
}

export function isPresentableError(error: unknown): error is PresentableError {
  return error instanceof PresentableError
}
