import type { ConversationStatus } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { useToast } from '@astryxdesign/core/Toast'
import { CheckCircle2Icon, ClockIcon, InboxIcon } from 'lucide-react'
import { useUpdateConversationStatus } from '../../hooks/use-conversations'

type Props = {
  workspaceId: string
  conversationId: string
  currentStatus: ConversationStatus
}

export function ContactPanelQuickActions({
  workspaceId,
  conversationId,
  currentStatus,
}: Props) {
  const showToast = useToast()
  const updateStatus = useUpdateConversationStatus(workspaceId)

  function apply(status: ConversationStatus) {
    if (status === currentStatus) return
    updateStatus.mutate(
      { conversationId, status },
      {
        onError: (error) => {
          showToast({
            body:
              error instanceof Error ? error.message : m.common_unknown_error(),
            type: 'error',
          })
        },
      },
    )
  }

  // Show "Close" + "Snooze" for open conversations; "Reopen" for non-open ones.
  if (currentStatus === 'open') {
    return (
      <div className="flex flex-col gap-2">
        <Button
          label={m.inbox_quick_action_close()}
          size="sm"
          variant="secondary"
          icon={<CheckCircle2Icon className="size-4" />}
          onClick={() => apply('closed')}
        />
        <Button
          label={m.inbox_quick_action_snooze()}
          size="sm"
          variant="secondary"
          icon={<ClockIcon className="size-4" />}
          onClick={() => apply('snoozed')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        label={m.inbox_quick_action_reopen()}
        size="sm"
        variant="secondary"
        icon={<InboxIcon className="size-4" />}
        onClick={() => apply('open')}
      />
    </div>
  )
}
