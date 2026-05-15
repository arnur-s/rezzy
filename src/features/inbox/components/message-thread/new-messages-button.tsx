import { m } from '@/paraglide/messages'
import { Button } from '@heroui/react'
import { ChevronDownIcon } from 'lucide-react'

type Props = {
  onPress: () => void
  count?: number
}

export function NewMessagesButton({ onPress, count }: Props) {
  const label =
    count === 1
      ? m.inbox_new_messages_button_one()
      : count && count > 1
        ? m.inbox_new_messages_button_many({ count })
        : m.inbox_new_messages_button()

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
      <Button
        size="sm"
        variant="secondary"
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full shadow-md"
        onPress={onPress}
        aria-label={label}
      >
        <span>{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-80" aria-hidden />
      </Button>
    </div>
  )
}
