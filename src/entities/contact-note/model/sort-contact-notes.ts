import type { ContactNote } from './types'

function descendingText(left: string, right: string) {
  return right.localeCompare(left)
}

export function sortContactNotes(notes: readonly ContactNote[]): ContactNote[] {
  return [...notes].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) {
      return left.is_pinned ? -1 : 1
    }

    return (
      descendingText(left.updated_at, right.updated_at) ||
      descendingText(left.created_at, right.created_at) ||
      descendingText(left.id, right.id)
    )
  })
}
