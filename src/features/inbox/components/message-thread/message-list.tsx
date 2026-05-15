import type { MessageRow } from '@/entities/message'
import { m } from '@/paraglide/messages'
import { Chip, Spinner } from '@heroui/react'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { buildMessageGroups } from '../../utils/message-groups'
import { isNearBottom } from '../../utils/message-scroll'
import type { InitialScrollTarget } from '../../utils/read-cursor'
import { MessageBubble } from './message-bubble'
import { NewMessagesButton } from './new-messages-button'
import { UnreadDivider } from './unread-divider'
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

function getUnreadDividerElement(root: HTMLDivElement): HTMLElement | null {
  const node = root.querySelector('[data-unread-divider]')
  if (!(node instanceof HTMLElement)) return null
  return node
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

  const resolvedMessages = messages ?? []

  if (resolvedMessages.length > MESSAGE_VIRTUALIZATION_THRESHOLD) {
    return (
      <VirtualizedMessageList
        key={conversationId}
        messages={resolvedMessages}
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
    <MessageListView
      key={conversationId}
      messages={resolvedMessages}
      contactName={contactName}
      initialScrollTarget={initialScrollTarget}
      unreadDividerMessageId={unreadDividerMessageId}
      readAnchorMessageId={readAnchorMessageId}
      markReadMessageId={markReadMessageId}
      onReadAnchorVisible={onReadAnchorVisible}
    />
  )
}

type ViewProps = {
  messages: Array<MessageRow>
  contactName: string
  initialScrollTarget: InitialScrollTarget
  unreadDividerMessageId: string | null
  readAnchorMessageId: string | null
  markReadMessageId: string | null
  onReadAnchorVisible: (lastReadMessageId: string) => void
}

function MessageListView({
  messages,
  contactName,
  initialScrollTarget,
  unreadDividerMessageId,
  readAnchorMessageId,
  markReadMessageId,
  onReadAnchorVisible,
}: ViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const lastCountRef = useRef(messages.length)
  const markedReadMessageIdRef = useRef<string | null>(null)
  const [frozenDividerMessageId] = useState(() => unreadDividerMessageId)
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)

  // Stable refs kept current so the once-registered scroll handler can read them.
  const latestMessageIdRef = useRef<string | null>(null)
  const onReadAnchorVisibleRef = useRef(onReadAnchorVisible)
  const tryMarkReadRef = useRef(() => {})

  useEffect(() => {
    latestMessageIdRef.current = messages.at(-1)?.id ?? null
  })
  useEffect(() => {
    onReadAnchorVisibleRef.current = onReadAnchorVisible
  })
  useEffect(() => {
    tryMarkReadRef.current = () => {
      const id = latestMessageIdRef.current
      if (!id || markedReadMessageIdRef.current === id) return
      markedReadMessageIdRef.current = id
      onReadAnchorVisibleRef.current(id)
    }
  })

  const groups = useMemo(() => buildMessageGroups(messages), [messages])

  const handleNewMessagesPress = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    setShowNewMessagesButton(false)
    setNewMessageCount(0)
    requestAnimationFrame(() => {
      scrollToBottom(node)
      tryMarkReadRef.current()
    })
  }, [])

  // Initial scroll: target the unread divider element first, then the message element.
  useEffect(() => {
    if (initialScrollDoneRef.current) return
    const root = scrollRef.current
    if (!root) return

    if (!initialScrollTarget.messageId) {
      initialScrollDoneRef.current = true
      stickToBottomRef.current = true
      tryMarkReadRef.current()
      return
    }

    const target =
      initialScrollTarget.reason === 'first-unread'
        ? (getUnreadDividerElement(root) ??
          getMessageElement(root, initialScrollTarget.messageId))
        : getMessageElement(root, initialScrollTarget.messageId)

    if (!target) return

    initialScrollDoneRef.current = true
    // `last-read` means all messages are read → treat as sticky, no button.
    stickToBottomRef.current = initialScrollTarget.reason !== 'first-unread'

    if (initialScrollTarget.reason === 'first-unread') {
      setShowNewMessagesButton(true)
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'auto' })
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'center', behavior: 'auto' })
        // Mark read immediately for latest/last-read conversations.
        if (initialScrollTarget.reason !== 'first-unread') {
          tryMarkReadRef.current()
        }
      })
    })
  }, [initialScrollTarget.messageId, initialScrollTarget.reason, messages])

  // New-message arrival: outbound always scrolls to bottom; inbound increments count.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const count = messages.length

    if (!initialScrollDoneRef.current) {
      lastCountRef.current = count
      return
    }

    if (count > lastCountRef.current) {
      const addedMessages = messages.slice(lastCountRef.current)
      const hasOutbound = addedMessages.some(
        (msg) => msg.direction === 'outbound',
      )
      const inboundCount = addedMessages.filter(
        (msg) => msg.direction === 'inbound',
      ).length

      if (stickToBottomRef.current || hasOutbound) {
        stickToBottomRef.current = true
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
        requestAnimationFrame(() => scrollToBottom(node))
        tryMarkReadRef.current()
      } else if (inboundCount > 0) {
        setShowNewMessagesButton(true)
        setNewMessageCount((prev) => prev + inboundCount)
      }
    }

    lastCountRef.current = count
  }, [messages])

  // Scroll event: update sticky ref, mark read when reaching bottom.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const onScroll = () => {
      const isAtBottom = isNearBottom(node)
      stickToBottomRef.current = isAtBottom
      if (isAtBottom) {
        setShowNewMessagesButton(false)
        setNewMessageCount(0)
        tryMarkReadRef.current()
      }
    }

    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [])

  // IntersectionObserver for the initial unread batch (complements tryMarkRead).
  useEffect(() => {
    if (
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
  }, [markReadMessageId, messages, onReadAnchorVisible, readAnchorMessageId])

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
      >
        <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex justify-center sticky top-0">
                <Chip>{group.heading}</Chip>
              </div>
              {group.items.map((message) => (
                <Fragment key={message.id}>
                  {message.id === frozenDividerMessageId ? (
                    <UnreadDivider />
                  ) : null}
                  <MessageBubble message={message} contactName={contactName} />
                </Fragment>
              ))}
            </section>
          ))}
        </div>
      </div>

      {showNewMessagesButton ? (
        <NewMessagesButton
          count={newMessageCount}
          onPress={handleNewMessagesPress}
        />
      ) : null}
    </div>
  )
}
