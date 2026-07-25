import { m } from '@/paraglide/messages'
import { MessageCircleIcon } from 'lucide-react'

type Props = {
  contactName: string
}

export function MessageThreadEmptyConversation({ contactName }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5 text-primary/40">
        <MessageCircleIcon className="size-8" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-primary">
        {m.inbox_thread_empty_title()}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-primary/60">
        {contactName
          ? m.inbox_thread_empty_description({ name: contactName })
          : m.inbox_thread_empty_description_no_name()}
      </p>
    </div>
  )
}
