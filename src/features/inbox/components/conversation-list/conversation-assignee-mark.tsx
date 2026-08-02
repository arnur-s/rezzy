import { WorkspaceMemberAvatar } from '@/entities/workspace'
import type { WorkspaceMember } from '@/entities/workspace'
import { m } from '@/paraglide/messages'
import { Tooltip } from '@astryxdesign/core/Tooltip'
import { UserRoundIcon } from 'lucide-react'

type Props = {
  assignee: WorkspaceMember | null
  /** True when the row carries an assignee id the workspace roster cannot resolve. */
  isUnresolved: boolean
}

/**
 * Who owns this conversation, as one 24px object at the end of the row's
 * status line.
 *
 * 24px because that is the height the status badge beside it already occupies
 * — a face that matched neither the badge nor the 12px metadata would add a
 * fourth vertical rhythm to a row that has three. It sits on the trailing edge
 * so the row gains one right-hand column reading time, then unread count, then
 * owner: three answers to "does this need me", stacked on a single axis.
 *
 * Renders nothing when nobody is assigned. An unassigned conversation is the
 * common case in a shared inbox, and a placeholder in every such row would put
 * a column of empty circles down the most-read surface in the product to say
 * "no" — the absence already says it, and the header is where the user goes to
 * change it.
 */
export function ConversationAssigneeMark({ assignee, isUnresolved }: Props) {
  if (assignee) {
    // Longer fuse than the header's control: this face is passed over rather
    // than aimed at, and a card that fires while the eye is still travelling
    // down the list is an interruption, not an answer.
    return (
      <WorkspaceMemberAvatar
        member={assignee}
        size="sm"
        placement="above"
        alignment="end"
        delay={450}
      />
    )
  }

  if (isUnresolved) {
    return (
      <Tooltip content={m.inbox_assignee_former_member_hint()}>
        <span
          className="bg-muted text-secondary flex size-6 shrink-0 items-center justify-center rounded-full"
          aria-label={m.inbox_assignee_former_member()}
        >
          <UserRoundIcon className="size-3.5" aria-hidden />
        </span>
      </Tooltip>
    )
  }

  return null
}
