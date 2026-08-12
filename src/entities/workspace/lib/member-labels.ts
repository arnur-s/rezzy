import type { WorkspaceMember } from '../model/member'

/**
 * Display labels for a whole roster, unique within it, keyed by user id.
 *
 * Two colleagues sharing a display name is ordinary — a workspace can hold two
 * Ивана Иванова, and a person with two accounts hits it on their own. A picker
 * that renders both as the same string offers a choice nobody can make.
 *
 * Astryx makes it worse than cosmetic: `DropdownMenu` keys its items by label
 * (`item-${label}`), so duplicate names are duplicate React keys, and React
 * reserves the right to drop or swap the rows outright.
 *
 * So the name is disambiguated only where it actually repeats — everyone else
 * keeps the plain name. The job title is the first tiebreaker because it is the
 * one fact a colleague can recognise someone by; the email that would settle it
 * is deliberately not in the roster payload. When that is missing or itself
 * shared, an ordinal is the honest remainder: it says "these are two different
 * people" without inventing a distinction, and it goes on *every* clashing row
 * rather than only the second, because a bare name beside a numbered one reads
 * as the real account next to a duplicate. Ordinals are stable because the RPC
 * orders the roster.
 */
export function workspaceMemberLabels(
  members: Array<WorkspaceMember>,
): Map<string, string> {
  const nameCounts = countBy(members.map((member) => member.fullName))

  // The job title can be shared too, so the tiebroken label is counted in its
  // own right rather than assumed to have settled anything.
  const bases = members.map((member) =>
    (nameCounts.get(member.fullName) ?? 0) > 1 && member.jobTitle
      ? `${member.fullName} · ${member.jobTitle}`
      : member.fullName,
  )
  const baseCounts = countBy(bases)

  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  members.forEach((member, index) => {
    const base = bases[index]
    if ((baseCounts.get(base) ?? 0) < 2) {
      labels.set(member.userId, base)
      return
    }
    const ordinal = (seen.get(base) ?? 0) + 1
    seen.set(base, ordinal)
    labels.set(member.userId, `${base} (${ordinal})`)
  })

  return labels
}

function countBy(values: Array<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}
