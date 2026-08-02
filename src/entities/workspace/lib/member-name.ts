import type { WorkspaceMember } from '../model/member'

/**
 * The first token of a member's name, for chrome too narrow to hold the whole
 * thing.
 *
 * Colleagues are on first-name terms and a face is already carrying the
 * identity, so "Анна" beside an avatar is more legible than "Анна Петрова-Свир…"
 * — a truncated surname is worse than no surname, because the ellipsis costs
 * the same width as the information it destroys. The full name still reaches
 * the accessible label and the hover card, so nothing is lost, only deferred.
 *
 * Falls back to the whole string when there is no whitespace to split on.
 */
export function workspaceMemberFirstName(member: WorkspaceMember): string {
  const trimmed = member.fullName.trim()
  return trimmed.split(/\s+/)[0] || trimmed
}
