import { m } from '@/paraglide/messages'
import { InboxIcon } from 'lucide-react'

export function MessageThreadEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-foreground/5 text-foreground/40">
        <InboxIcon className="size-8" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">
        {m.inbox_empty_select_conversation_title()}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-foreground/60">
        {m.inbox_empty_select_conversation_description()}
      </p>
    </div>
  )
}
