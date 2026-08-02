import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Badge } from '@astryxdesign/core/Badge'
import { PhoneIcon } from 'lucide-react'
import { workspaceMemberRoleLabel } from '../lib/member-role'
import type { WorkspaceMember } from '../model/member'

type Props = {
  member: WorkspaceMember
}

/**
 * The teammate identity card: who they are, what they do, and how to reach them.
 *
 * Sized rather than fluid. A hover card that grows with its content jumps
 * between rows as the cursor moves down a list, and the base locale is Russian,
 * whose names and job titles run 15-30% longer than the English they were
 * measured against — so the box is fixed and the long strings wrap inside it
 * instead of the box tracking the string. Two lines is the cap on each: past
 * that a name is not being read, it is being decoded.
 *
 * The phone is a bare number behind an icon rather than a labelled field. It is
 * the only number on the card, so a label would only repeat what the glyph
 * already says, and the label is exactly the width Russian cannot spare.
 * Deliberately not a `tel:` link: this card is rendered inside a conversation
 * row, and an anchor nested in that row's button is both invalid and a click
 * target that would fight the row's own.
 */
export function WorkspaceMemberCard({ member }: Props) {
  const jobTitle = member.jobTitle?.trim()
  const phone = member.phone?.trim()

  return (
    <div className="flex w-60 items-start gap-3">
      <Avatar size="md" name={member.fullName} src={member.avatarUrl ?? undefined} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-primary line-clamp-2 text-base leading-snug font-semibold">
          {member.fullName}
        </p>

        {/* Job title and workspace role are two different facts and the card
            keeps them apart: the title is what this person does, the role is
            what the workspace lets them do. They share a wrapping row because
            together they are one answer — "who is this to me" — and because in
            English they almost always fit on one line. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {jobTitle ? (
            <span className="text-secondary line-clamp-2 min-w-0 text-sm">
              {jobTitle}
            </span>
          ) : null}
          <Badge
            variant="neutral"
            label={workspaceMemberRoleLabel(member.role)}
          />
        </div>

        {phone ? (
          <span className="text-secondary flex items-center gap-1.5 text-sm">
            <PhoneIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{phone}</span>
          </span>
        ) : (
          <span className="text-disabled text-sm">
            {m.workspace_member_no_phone()}
          </span>
        )}
      </div>
    </div>
  )
}
