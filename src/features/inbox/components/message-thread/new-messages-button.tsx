import { m } from '@/paraglide/messages'
import { Button } from '@heroui/react'

type Props = {
  onPress: () => void
}

export function NewMessagesButton({ onPress }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
      <Button
        size="sm"
        variant="primary"
        className="pointer-events-auto shadow-lg"
        onPress={onPress}
      >
        {m.inbox_new_messages_button()}
      </Button>
    </div>
  )
}
