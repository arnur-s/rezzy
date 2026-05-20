import { useVoiceInput } from '@/hooks/use-voice-input'
import { m } from '@/paraglide/messages'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Button, Popover, TextArea, Tooltip, toast } from '@heroui/react'
import { cn } from '@heroui/styles'
import {
  FileTextIcon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  SmileIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { containsEmoji } from '../../utils/emoji-text'
import { FormattedMessageText } from '../formatted-message-text'

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
    <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-2 py-1.5 text-xs">
      {isImage && previewUrl ? (
        <img
          src={previewUrl}
          alt={file.name}
          className="size-8 rounded object-cover"
        />
      ) : (
        <FileTextIcon className="size-4 shrink-0 text-foreground/60" />
      )}
      <span className="max-w-[160px] truncate text-foreground/70">
        {file.name}
      </span>
      {!isImage && (
        <span className="text-foreground/40">
          {file.type.split('/')[1]?.toUpperCase()}
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        onPress={onRemove}
        className="ml-auto min-w-0 shrink-0 text-foreground/40 hover:text-foreground"
        aria-label={m.inbox_composer_remove_attachment_label()}
      >
        <XIcon className="size-3.5" />
      </Button>
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
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
  autoFocusKey,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

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
    lang: 'ru-RU',
    onResult: appendTranscript,
    onError: (code) => {
      if (code === 'aborted') return
      if (code === 'no-speech') {
        toast.info(m.inbox_composer_voice_no_speech())
        return
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        toast.danger(m.inbox_composer_voice_permission_denied())
        return
      }
      toast.danger(m.inbox_composer_voice_error())
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

  const showInterimOverlay = isRecording && interimText.length > 0
  const showStyledMirror = showInterimOverlay || containsEmoji(text)

  const canSend = (text.trim().length > 0 || attachment !== null) && !disabled
  const showMicButton = isVoiceSupported && !canSend && !disabled
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

  function handleSend() {
    if (!canSend) return
    onSend(text.trim(), attachment)
    setText('')
    setAttachment(null)
    const el = textareaRef.current
    if (el) {
      el.style.height = '36px'
      el.focus()
    }
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
      setText('')
      setAttachment(null)
      const el = textareaRef.current
      if (el) el.style.height = '36px'
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

  return (
    <div className="relative">
      <div
        className={cn(
          'flex flex-col gap-2',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {attachment && (
          <AttachmentChip
            file={attachment}
            onRemove={() => setAttachment(null)}
          />
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div className="relative flex min-w-0 flex-1 items-center">
            {showStyledMirror && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden px-2 py-1 text-sm leading-6 wrap-break-word whitespace-pre-wrap"
              >
                <FormattedMessageText
                  as="span"
                  content={text}
                  variant="composer"
                />
                {showInterimOverlay ? (
                  <span className="text-foreground/40">{interimText}</span>
                ) : null}
              </div>
            )}
            <TextArea
              ref={textareaRef}
              variant="secondary"
              style={{ height: '36px', minHeight: '36px' }}
              rows={1}
              value={text}
              placeholder={effectivePlaceholder}
              disabled={disabled}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className={cn(
                'w-full',
                showStyledMirror && 'text-transparent caret-foreground',
              )}
            />
          </div>

          {showMicButton ? (
            <Tooltip>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                isIconOnly
                isDisabled={disabled}
                aria-label={m.inbox_composer_voice_label()}
                aria-pressed={isRecording}
                onPointerDown={handleMicPointerDown}
                onPointerUp={handleMicPointerEnd}
                onPointerCancel={handleMicPointerEnd}
                onPointerLeave={handleMicPointerEnd}
                onContextMenu={(e) => e.preventDefault()}
                className={cn(
                  'relative',
                  isRecording && 'text-danger ring-2 ring-danger/40',
                )}
              >
                {isRecording && (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-danger/15 animate-ping motion-reduce:animate-none"
                  />
                )}
                <MicIcon className="relative size-4" />
              </Button>
              <Tooltip.Content>
                <p>{m.inbox_composer_voice_hold_to_record()}</p>
              </Tooltip.Content>
            </Tooltip>
          ) : (
            <Button
              size="sm"
              variant="primary"
              isIconOnly
              isDisabled={!canSend}
              onPress={handleSend}
              aria-label={m.inbox_composer_send_label()}
            >
              <SendIcon className="size-4" />
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            isDisabled={disabled}
            onPress={() => fileInputRef.current?.click()}
            aria-label={m.inbox_composer_attach_file_label()}
          >
            <PaperclipIcon className="size-4" />
          </Button>

          <Popover isOpen={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
            <Popover.Trigger>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                isDisabled={disabled}
                aria-label={m.inbox_composer_emoji_label()}
              >
                <SmileIcon className="size-4" />
              </Button>
            </Popover.Trigger>
            <Popover.Content
              className="max-w-none border-0 bg-transparent p-0 shadow-none"
              placement="top"
            >
              <Popover.Dialog className="border-0 p-0 shadow-lg">
                <Picker
                  data={data}
                  onEmojiSelect={handleEmojiSelect}
                  theme="auto"
                />
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
      </div>
    </div>
  )
}
