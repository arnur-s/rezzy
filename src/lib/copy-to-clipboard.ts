/**
 * Copy text to the clipboard, reporting success rather than throwing.
 *
 * `navigator.clipboard` is undefined on insecure origins and can reject when the
 * document is not focused, so every call site needs the failure branch; a
 * boolean keeps that from being a try/catch at each one.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false

  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
