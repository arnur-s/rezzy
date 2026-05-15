import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Button, Chip, Spinner } from '@heroui/react'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { isNearBottom } from '../../utils/message-scroll'
import { dayKey, formatDayHeading } from '../../utils/relative-time'
import { MessageBubble } from './message-bubble'
import { VirtualizedMessageList } from './virtualized-message-list'

const MESSAGE_VIRTUALIZATION_THRESHOLD = 80

function scrollToBottom(node: HTMLDivElement) {
  node.scrollTop = node.scrollHeight
}

function getMessageElement(
  root: HTMLDivElement,
  messageId: string,
): HTMLElement | null {
  const node = document.getElementById(`message-${messageId}`)
  if (!(node instanceof HTMLElement)) return null
  return root.contains(node) ? node : null
}

type Props = {
  conversationId: string
  messages: Array<MessageRow> | undefined
  isLoading: boolean
  isError: boolean
  contactName: string
  initialScrollTarget: InitialScrollTarget
  unreadDividerMessageId: string | null
  readAnchorMessageId: string | null
  markReadMessageId: string | null
  onReadAnchorVisible: (lastReadMessageId: string) => void
}

type Group = {
  key: string
  heading: string
  items: Array<MessageRow>
}

export function MessageList({
  conversationId,
  messages,
  isLoading,
  isError,
  contactName,
  initialScrollTarget,
  unreadDividerMessageId,
  readAnchorMessageId,
  markReadMessageId,
  onReadAnchorVisible,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const lastCountRef = useRef(0)
  const lastConversationIdRef = useRef<string | null>(null)
  const markedReadMessageIdRef = useRef<string | null>(null)
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false)

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

  const handleNewMessagesPress = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    setShowNewMessagesButton(false)
    requestAnimationFrame(() => scrollToBottom(node))
  }, [])

  useEffect(() => {
    initialScrollDoneRef.current = false
    lastCountRef.current = 0
    lastConversationIdRef.current = null
    markedReadMessageIdRef.current = null
    stickToBottomRef.current = true
    setShowNewMessagesButton(false)
  }, [conversationId])

  useEffect(() => {
    if (isLoading || isError || initialScrollDoneRef.current) return
    const root = scrollRef.current
    if (!root) return

    if (!initialScrollTarget.messageId) {
      initialScrollDoneRef.current = true
      return
    }

    const target = getMessageElement(root, initialScrollTarget.messageId)
    if (!target) return

    initialScrollDoneRef.current = true
    stickToBottomRef.current = initialScrollTarget.reason === 'latest'

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'auto' })
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'center', behavior: 'auto' })
      })
    })
  }, [
    conversationId,
    initialScrollTarget.messageId,
    initialScrollTarget.reason,
    isError,
    isLoading,
    messages,
  ])

  useEffect(() => {
    if (isLoading || isError) return
    const node = scrollRef.current
    const count = messages?.length ?? 0
    if (!node) return

    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId
      lastCountRef.current = count
      return
    }

    if (count > lastCountRef.current) {
      const addedMessages = messages?.slice(lastCountRef.current) ?? []
      const hasIncomingMessage = addedMessages.some(
        (message) => message.direction === 'inbound',
      )

      if (stickToBottomRef.current) {
        setShowNewMessagesButton(false)
        requestAnimationFrame(() => scrollToBottom(node))
      } else if (hasIncomingMessage) {
        setShowNewMessagesButton(true)
      }
    }

    lastCountRef.current = count
  }, [conversationId, isError, isLoading, messages])

  useEffect(() => {
    if (isLoading || isError) return
    const scrollNode = scrollRef.current
    const contentNode = contentRef.current
    if (!scrollNode || !contentNode) return

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return
      requestAnimationFrame(() => {
        if (!stickToBottomRef.current) return
        scrollToBottom(scrollNode)
      })
    })

    observer.observe(contentNode)
    return () => observer.disconnect()
  }, [conversationId, isError, isLoading])

  useEffect(() => {
    if (isLoading || isError) return
    const node = scrollRef.current
    if (!node) return

    const onScroll = () => {
      const isAtBottom = isNearBottom(node)
      stickToBottomRef.current = isAtBottom
      if (isAtBottom) {
        setShowNewMessagesButton(false)
      }
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [conversationId, isError, isLoading])

  useEffect(() => {
    if (
      isLoading ||
      isError ||
      !markReadMessageId ||
      markedReadMessageIdRef.current === markReadMessageId ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return
    }

    const root = scrollRef.current
    if (!root) return

    const anchorIds = Array.from(
      new Set(
        [readAnchorMessageId, markReadMessageId].filter(
          (messageId): messageId is string => !!messageId,
        ),
      ),
    )
    const targets = anchorIds
      .map((messageId) => getMessageElement(root, messageId))
      .filter((node): node is HTMLElement => node !== null)

    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (markedReadMessageIdRef.current === markReadMessageId) return

        markedReadMessageIdRef.current = markReadMessageId
        onReadAnchorVisible(markReadMessageId)
        observer.disconnect()
      },
      { root, threshold: 0.6 },
    )

    for (const target of targets) {
      observer.observe(target)
    }

    return () => observer.disconnect()
  }, [
    conversationId,
    isError,
    isLoading,
    markReadMessageId,
    messages,
    onReadAnchorVisible,
    readAnchorMessageId,
  ])

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

  if (messages && messages.length > MESSAGE_VIRTUALIZATION_THRESHOLD) {
    return (
      <VirtualizedMessageList
        conversationId={conversationId}
        messages={messages}
        contactName={contactName}
        initialScrollTarget={initialScrollTarget}
        unreadDividerMessageId={unreadDividerMessageId}
        readAnchorMessageId={readAnchorMessageId}
        markReadMessageId={markReadMessageId}
        onReadAnchorVisible={onReadAnchorVisible}
      />
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <div ref={contentRef} className="flex flex-col gap-6 px-4 py-6 sm:px-6">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex justify-center">
                <Chip>{group.heading}</Chip>
              </div>
              {group.items.map((message) => (
                <Fragment key={message.id}>
                  {message.id === unreadDividerMessageId ? (
                    <UnreadDivider />
                  ) : null}
                  <MessageBubble
                    message={message}
                    contactName={contactName}
                  />
                </Fragment>
              ))}
            </section>
          ))}
        </div>
      </div>

      {showNewMessagesButton ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <Button
            size="sm"
            variant="primary"
            className="pointer-events-auto shadow-lg"
            onPress={handleNewMessagesPress}
          >
            {m.inbox_new_messages_button()}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border/70" />
      <Chip color="accent" size="sm" variant="soft">
        {m.inbox_unread_messages_divider()}
      </Chip>
      <div className="h-px flex-1 bg-border/70" />
    </div>
  )
}
