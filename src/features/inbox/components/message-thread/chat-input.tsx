import { useVoiceInput } from '@/hooks/use-voice-input'
import { cn } from '@/lib/cn'
import { m } from '@/paraglide/messages'
import { ChatComposer } from '@astryxdesign/core/Chat'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Popover } from '@astryxdesign/core/Popover'
import { useToast } from '@astryxdesign/core/Toast'
import {
  FileTextIcon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  SmileIcon,
  XIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearConversationDraft,
  getConversationDraft,
  setConversationDraft,
} from '../../utils/conversation-drafts'
import { containsEmoji } from '../../utils/emoji-text'
import { FormattedMessageText } from '../formatted-message-text'
import { EmojiPicker } from './emoji-picker'

const MAX_HEIGHT = 24 * 5 // 5 lines × 24px line-height

function resize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  const scrollH = el.scrollHeight
  el.style.height = Math.min(scrollH, MAX_HEIGHT) + 'px'
  el.style.overflowY = scrollH > MAX_HEIGHT ? 'auto' : 'hidden'
}

interface AttachmentChipProps {
  file: File
  onRemove: () => void
}

function AttachmentChip({ file, onRemove }: AttachmentChipProps) {
  const isImage = file.type.startsWith('image/')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isImage) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  return (
    <div className="bg-primary/5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
      {isImage && previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="size-8 rounded object-cover"
        />
      ) : (
        <FileTextIcon className="text-primary/60 size-4 shrink-0" />
      )}
      <span className="text-primary/70 max-w-40 truncate">{file.name}</span>
      {!isImage && (
        <span className="text-secondary">
          {file.type.split('/')[1]?.toUpperCase()}
        </span>
      )}
      <span className="ml-auto shrink-0">
        <IconButton
          size="sm"
          variant="ghost"
          onClick={onRemove}
          label={m.inbox_composer_remove_attachment_label()}
          icon={<XIcon className="size-3.5" />}
        />
      </span>
    </div>
  )
}

export interface ChatInputProps {
  onSend: (text: string, file: File | null) => void
  disabled?: boolean
  placeholder?: string
  /**
   * When set, the textarea will focus after the next animation frame whenever
   * this value changes. Pass `undefined` on touch devices to avoid summoning
   * the soft keyboard on every conversation switch.
   */
  autoFocusKey?: string
  acceptedMimeTypes?: string
  /** Extra drawer content above the input (e.g. the reply preview bar). */
  drawer?: ReactNode
  /**
   * When set, the typed text is persisted per key so it survives this
   * component unmounting (a conversation switch) and a full reload.
   */
  draftKey?: string
  /** Escape unwinds the reply target before falling back to blurring. */
  onCancelReply?: () => void
  /**
   * Prevents sending while keeping the field editable (e.g. offline): the
   * draft keeps accumulating so nothing typed is lost.
   */
  blockSend?: boolean
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
  autoFocusKey,
  acceptedMimeTypes = 'image/*,video/*,application/pdf',
  drawer,
  draftKey,
  onCancelReply,
  blockSend = false,
}: ChatInputProps) {
  const [text, setText] = useState(() =>
    draftKey ? getConversationDraft(draftKey) : '',
  )
  const [attachment, setAttachment] = useState<File | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const showToast = useToast()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const appendTranscript = useCallback((transcript: string) => {
    if (!transcript) return
    setText((prev) => {
      const next = prev.trimEnd()
      const separator = next.length > 0 ? ' ' : ''
      return next + separator + transcript
    })
  }, [])

  const {
    isRecording,
    interimText,
    startRecording,
    stopRecording,
    isSupported: isVoiceSupported,
  } = useVoiceInput({
    lang: navigator.language,
    onResult: appendTranscript,
    onError: (code) => {
      if (code === 'aborted') return
      if (code === 'no-speech') {
        showToast({ body: m.inbox_composer_voice_no_speech(), type: 'info' })
        return
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        showToast({
          body: m.inbox_composer_voice_permission_denied(),
          type: 'error',
        })
        return
      }
      showToast({ body: m.inbox_composer_voice_error(), type: 'error' })
    },
  })

  useEffect(() => {
    if (autoFocusKey == null) return
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [autoFocusKey])

  useEffect(() => {
    const el = textareaRef.current
    if (el) resize(el)
  }, [text])

  // Persist on every keystroke so an unmount (conversation switch) or reload
  // never loses in-progress text.
  useEffect(() => {
    if (draftKey) setConversationDraft(draftKey, text)
  }, [draftKey, text])

  const showInterimOverlay = isRecording && interimText.length > 0
  const showStyledMirror = showInterimOverlay || containsEmoji(text)

  const isEmpty = text.trim().length === 0 && attachment === null
  const canSend = !isEmpty && !disabled && !blockSend
  // Mic replaces send only while the field is genuinely empty, so a blocked
  // send (offline) still reads as a disabled send button, not a mic.
  const showMicButton = isVoiceSupported && isEmpty && !disabled
  const showListeningHint =
    isRecording && interimText.length === 0 && text.length === 0
  const effectivePlaceholder = showListeningHint
    ? m.inbox_composer_voice_listening()
    : placeholder

  function handleMicPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startRecording()
  }

  function handleMicPointerEnd(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    stopRecording()
    textareaRef.current?.focus()
  }

  // Keyboard equivalent of press-and-hold: hold Space/Enter to dictate, release
  // to stop. Guarded against key auto-repeat re-triggering the start.
  function handleMicKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled || e.repeat) return
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (!isRecording) startRecording()
  }

  function handleMicKeyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    stopRecording()
  }

  function resetTextareaHeight() {
    const el = textareaRef.current
    if (el) el.style.height = ''
  }

  function handleSend() {
    if (!canSend) return
    onSend(text.trim(), attachment)
    setText('')
    setAttachment(null)
    if (draftKey) clearConversationDraft(draftKey)
    resetTextareaHeight()
    textareaRef.current?.focus()
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    resize(e.target)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    } else if (e.key === 'Escape') {
      // Escape unwinds one thing at a time and never destroys typed text: drop
      // the attachment, else cancel the reply target, else just blur.
      if (attachment) {
        e.preventDefault()
        setAttachment(null)
      } else if (onCancelReply) {
        e.preventDefault()
        onCancelReply()
      } else {
        textareaRef.current?.blur()
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = e.clipboardData.files.item(0)
    if (!file || !file.type.startsWith('image/')) return
    e.preventDefault()
    setAttachment(file)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachment(file)
    e.target.value = ''
  }

  function handleEmojiSelect(emoji: { native: string }) {
    setText((prev) => prev + emoji.native)
    setEmojiPickerOpen(false)
    textareaRef.current?.focus()
  }

  const hasDrawerContent = drawer != null || attachment !== null

  return (
    <ChatComposer
      value={text}
      onChange={setText}
      onSubmit={handleSend}
      placeholder={effectivePlaceholder}
      isDisabled={disabled}
      drawer={
        hasDrawerContent ? (
          // px-3 puts drawer content on the composer's own content column
          // (the field box starts 12px in), so the dock reads as one stack
          // instead of a reply strip hanging off its left edge.
          <span className="flex flex-col gap-2 px-3">
            {drawer}
            {attachment ? (
              <AttachmentChip
                file={attachment}
                onRemove={() => setAttachment(null)}
              />
            ) : null}
          </span>
        ) : undefined
      }
      input={
        <span className="relative flex min-w-0 flex-1 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedMimeTypes}
            className="hidden"
            onChange={handleFileInputChange}
          />
          {showStyledMirror && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden px-2 py-1 text-sm pointer-coarse:text-[16px] leading-6 wrap-break-word whitespace-pre-wrap"
            >
              <FormattedMessageText
                as="span"
                content={text}
                variant="composer"
              />
              {showInterimOverlay ? (
                <span className="text-secondary">{interimText}</span>
              ) : null}
            </span>
          )}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            // A stable accessible name: the placeholder doubles as the visible
            // label but mutates to "Listening…" mid-dictation, which would
            // otherwise rename the field under a screen reader.
            aria-label={m.inbox_composer_message_label()}
            placeholder={effectivePlaceholder}
            disabled={disabled}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={cn(
              // Transparent: the composer surface around it is the field.
              'h-9 min-h-9 w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 shadow-none',
              // iOS Safari zooms the viewport when a focused control computes
              // to under 16px, and `text-sm` is 12px here. 16px is Safari's
              // threshold, not a type-scale step: the nearest token above it
              // (`text-lg`, 17px) would also rebind the line-height that the
              // 5-line `MAX_HEIGHT` cap is measured against. The emoji mirror
              // above carries the same pair or the caret drifts under it.
              'pointer-coarse:text-[16px]',
              'ring-0 outline-none focus:ring-0 focus-visible:ring-0',
              showStyledMirror && 'caret-primary text-transparent',
            )}
          />
        </span>
      }
      headerActions={
        <>
          <IconButton
            size="sm"
            variant="ghost"
            isDisabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            label={m.inbox_composer_attach_file_label()}
            icon={<PaperclipIcon className="size-4" />}
          />
          <Popover
            isOpen={emojiPickerOpen}
            onOpenChange={setEmojiPickerOpen}
            placement="above"
            hasCloseButton={false}
            label={m.inbox_composer_emoji_label()}
            className="p-0"
            content={
              emojiPickerOpen ? (
                <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              ) : null
            }
          >
            <IconButton
              size="sm"
              variant="ghost"
              isDisabled={disabled}
              label={m.inbox_composer_emoji_label()}
              icon={<SmileIcon className="size-4" />}
            />
          </Popover>
        </>
      }
      sendButton={
        // The terminal action swaps: hold-to-record mic while the input is
        // empty (and voice is supported), the send commit once there is
        // something to send.
        showMicButton ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={m.inbox_composer_voice_label()}
            aria-pressed={isRecording}
            title={m.inbox_composer_voice_hold_to_record()}
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerEnd}
            onPointerCancel={handleMicPointerEnd}
            onPointerLeave={handleMicPointerEnd}
            onKeyDown={handleMicKeyDown}
            onKeyUp={handleMicKeyUp}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              'relative inline-flex size-8 items-center justify-center rounded-md text-primary/70 hover:bg-primary/5',
              isRecording && 'text-error ring-error/40 ring-2',
            )}
          >
            {isRecording && (
              <span
                aria-hidden
                className="bg-error/15 absolute inset-0 animate-ping rounded-full motion-reduce:animate-none"
              />
            )}
            <MicIcon className="relative size-4" />
          </button>
        ) : (
          <IconButton
            size="sm"
            variant="primary"
            isDisabled={!canSend}
            onClick={handleSend}
            label={m.inbox_composer_send_label()}
            icon={<SendIcon className="size-4" />}
          />
        )
      }
    />
  )
}
