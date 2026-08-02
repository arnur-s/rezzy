import { Avatar } from '@astryxdesign/core/Avatar'
import { HoverCard } from '@astryxdesign/core/HoverCard'
import type { HoverCardProps } from '@astryxdesign/core/HoverCard'
import { WorkspaceMemberCard } from './workspace-member-card'
import type { WorkspaceMember } from '../model/member'

type Props = {
  member: WorkspaceMember
  size?: 'xsm' | 'sm' | 'md'
  placement?: HoverCardProps['placement']
  alignment?: HoverCardProps['alignment']
  /**
   * Milliseconds of hover before the card appears. Tune it to how deliberate
   * the pointer is: a face parked in a scanning list wants a longer fuse than
   * one the user has aimed at.
   */
  delay?: number
  /** Suppresses the card without unmounting the face — e.g. while a menu owns the same anchor. */
  isEnabled?: boolean
}

/**
 * A teammate's face, with their card on hover.
 *
 * The face is the point: a name has to be read, a face is recognised, and the
 * inbox repeats the same handful of colleagues down a list where every row is
 * already carrying a contact name, a preview and a timestamp. The card is what
 * makes the face honest — an unfamiliar avatar is a puzzle until you can put a
 * name, a job and a number to it without leaving the row.
 *
 * Not keyboard-reachable by design. The trigger is a plain element, so
 * `focusTrigger='auto'` attaches nothing, which is what keeps this safe to drop
 * inside a conversation row: a focusable trigger nested in that row's button
 * would put a second tab stop inside a single control. Every surface using this
 * must therefore carry the assignee's name in its own accessible name — the
 * card is an accelerator for the pointer, never the only copy of the fact.
 */
export function WorkspaceMemberAvatar({
  member,
  size = 'sm',
  placement = 'above',
  alignment = 'end',
  delay,
  isEnabled = true,
}: Props) {
  return (
    <HoverCard
      content={<WorkspaceMemberCard member={member} />}
      placement={placement}
      alignment={alignment}
      delay={delay}
      isEnabled={isEnabled}
    >
      <span className="flex shrink-0">
        <Avatar
          size={size}
          name={member.fullName}
          src={member.avatarUrl ?? undefined}
        />
      </span>
    </HoverCard>
  )
}
