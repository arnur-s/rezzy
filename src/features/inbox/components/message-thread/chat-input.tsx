import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Button } from '@heroui/react'
import { cn } from '@heroui/styles'
import {
  FileTextIcon,
  PaperclipIcon,
  SendIcon,
  SmileIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { m } from '@/paraglide/messages'

const MAX_HEIGHT = 24 * 5 // 5 lines × 24px line-height

function resize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px'
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
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto shrink-0 text-foreground/40 hover:text-foreground"
        aria-label={m.inbox_composer_remove_attachment_label()}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

export interface ChatInputProps {
  onSend: (text: string, file: File | null) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!showEmojiPicker) return
    function handleMouseDown(e: MouseEvent) {
      if (
        emojiContainerRef.current &&
        !emojiContainerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [showEmojiPicker])

  const canSend = (text.trim().length > 0 || attachment !== null) && !disabled

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
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  return (
    <div className="relative">
      {showEmojiPicker && (
        <div
          ref={emojiContainerRef}
          className="absolute bottom-full right-0 z-50 mb-2"
        >
          <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="auto" />
        </div>
      )}

      <div
        className={cn(
          'flex flex-col gap-2 rounded-2xl border border-border/60 p-2 transition-colors',
          'focus-within:border-ring',
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

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <textarea
            ref={textareaRef}
            className="flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-foreground/40"
            style={{ height: '36px' }}
            rows={1}
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />

          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            isDisabled={disabled}
            onPress={() => setShowEmojiPicker((v) => !v)}
            aria-label={m.inbox_composer_emoji_label()}
          >
            <SmileIcon className="size-4" />
          </Button>

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
        </div>
      </div>
    </div>
  )
}
