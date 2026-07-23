/** First letters of up to two name words, uppercased; em dash when empty. */
export function initialsFromName(name: string | null | undefined): string {
  const trimmed = name?.trim()
  if (!trimmed) return '—'
  const initials = trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  return initials || '—'
}
