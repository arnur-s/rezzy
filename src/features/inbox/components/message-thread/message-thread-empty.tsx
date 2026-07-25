import { m } from '@/paraglide/messages'
import { InboxIcon } from 'lucide-react'

export function MessageThreadEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
        <InboxIcon className="size-8" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-primary">
        {m.inbox_empty_select_conversation_title()}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-primary/60">
        {m.inbox_empty_select_conversation_description()}
      </p>
    </div>
  )
}
