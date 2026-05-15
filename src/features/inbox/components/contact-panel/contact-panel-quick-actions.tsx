import type { ConversationStatus } from '@/entities/conversation'
import { m } from '@/paraglide/messages'
import { Button, toast } from '@heroui/react'
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
  const updateStatus = useUpdateConversationStatus(workspaceId)

  function apply(status: ConversationStatus) {
    if (status === currentStatus) return
    updateStatus.mutate(
      { conversationId, status },
      {
        onError: (error) => {
          toast.danger(m.inbox_contact_panel_status_save_error(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
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
          size="sm"
          variant="secondary"
          onPress={() => {
            apply('closed')
          }}
        >
          <CheckCircle2Icon className="size-4" />
          {m.inbox_quick_action_close()}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => {
            apply('snoozed')
          }}
        >
          <ClockIcon className="size-4" />
          {m.inbox_quick_action_snooze()}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="secondary"
        onPress={() => {
          apply('open')
        }}
      >
        <InboxIcon className="size-4" />
        {m.inbox_quick_action_reopen()}
      </Button>
    </div>
  )
}
