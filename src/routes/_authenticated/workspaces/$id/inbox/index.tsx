import { paneStyle } from '@/components/pane'
import { MessageThreadEmpty } from '@/features/inbox/components/message-thread/message-thread-empty'
import { cn } from '@heroui/styles'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/workspaces/$id/inbox/')({
  component: RouteComponent,
})

function RouteComponent() {
  // Occupies the conversation pane slot, so it carries the same pane chrome.
  return (
    <div className={cn(paneStyle.surface, 'h-full w-full')}>
      <MessageThreadEmpty />
    </div>
  )
}
