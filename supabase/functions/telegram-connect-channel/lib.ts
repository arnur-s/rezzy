/** Telegram's shared secret must be independent of the publicly visible channel id. */
export function createWebhookSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
