/**
 * Minimal className combiner (clsx-style). Accepts strings, numbers, arrays,
 * and `{ class: condition }` objects; falsy values are dropped.
 *
 * Astryx does not ship a class combiner (its philosophy is component props
 * first, token-backed utilities second), so we keep a small local one for the
 * remaining Tailwind utility composition.
 */
export type ClassValue =
  | string
  | number
  | bigint
  | null
  | undefined
  | boolean
  | Array<ClassValue>
  | { [key: string]: boolean | null | undefined }

export function cn(...inputs: Array<ClassValue>): string {
  const classes: Array<string> = []

  for (const input of inputs) {
    if (!input) continue

    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'bigint') {
      classes.push(String(input))
      continue
    }

    if (Array.isArray(input)) {
      const nested = cn(...input)
      if (nested) classes.push(nested)
      continue
    }

    if (typeof input === 'object') {
      for (const key in input) {
        if (input[key]) classes.push(key)
      }
    }
  }

  return classes.join(' ')
}
