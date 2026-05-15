import { m } from '@/paraglide/messages'
import { Button } from '@heroui/react'

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
        variant="primary"
        className="pointer-events-auto shadow-lg"
        onPress={onPress}
        aria-label={label}
      >
        {label}
      </Button>
    </div>
  )
}
