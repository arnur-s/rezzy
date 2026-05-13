import { m } from '@/paraglide/messages'
import { Chip, Spinner } from '@heroui/react'
import { useEffect, useMemo, useRef } from 'react'
import type { MessageRow } from '../../types'
import { dayKey, formatDayHeading } from '../../utils/relative-time'
import { MessageBubble } from './message-bubble'

type Props = {
  messages: Array<MessageRow> | undefined
  isLoading: boolean
  isError: boolean
  contactName: string
}

type Group = {
  key: string
  heading: string
  items: Array<MessageRow>
}

export function MessageList({
  messages,
  isLoading,
  isError,
  contactName,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastCountRef = useRef(0)

  const groups = useMemo<Array<Group>>(() => {
    if (!messages) return []
    const acc: Array<Group> = []
    for (const message of messages) {
      const key = dayKey(message.created_at)
      const last = acc.length > 0 ? acc[acc.length - 1] : null
      if (last && last.key === key) {
        last.items.push(message)
      } else {
        acc.push({
          key,
          heading: formatDayHeading(message.created_at),
          items: [message],
        })
      }
    }
    return acc
  }, [messages])

  useEffect(() => {
    const node = scrollRef.current
    const count = messages?.length ?? 0
    if (!node) return
    if (count > lastCountRef.current) {
      node.scrollTop = node.scrollHeight
    }
    lastCountRef.current = count
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm text-danger">{m.inbox_messages_load_error()}</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-3">
            <div className="flex justify-center">
              <Chip>{group.heading}</Chip>
            </div>
            {group.items.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                contactName={contactName}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
