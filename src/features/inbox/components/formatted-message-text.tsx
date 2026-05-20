import { cn } from '@heroui/styles'
import {
  countEmojiGraphemes,
  isEmojiOnlyMessage,
  splitMessageSegments,
} from '../utils/emoji-text'

export type FormattedMessageTextVariant = 'bubble' | 'preview' | 'composer'

type Props = {
  content: string
  variant: FormattedMessageTextVariant
  className?: string
  as?: 'p' | 'span'
}

function getVariantBaseClass(variant: FormattedMessageTextVariant): string | undefined {
  if (variant === 'preview') return 'text-xs leading-5'
  return undefined
}

function getEmojiOnlyClass(
  variant: FormattedMessageTextVariant,
  emojiCount: number,
): string | undefined {
  if (emojiCount === 0) return undefined

  if (variant === 'preview') {
    return emojiCount <= 3 ? 'text-lg leading-snug' : 'text-base leading-snug'
  }

  return emojiCount <= 3 ? 'text-2xl leading-snug' : 'text-xl leading-snug'
}

function getInlineEmojiClass(variant: FormattedMessageTextVariant): string {
  switch (variant) {
    case 'preview':
      return 'inline-block align-baseline text-base leading-none'
    case 'bubble':
    case 'composer':
      return 'inline-block align-baseline text-[1.35em] leading-none'
  }
}

export function FormattedMessageText({
  content,
  variant,
  className,
  as: Tag = 'p',
}: Props) {
  const emojiOnly = isEmojiOnlyMessage(content)
  const emojiCount = countEmojiGraphemes(content)
  const segments = splitMessageSegments(content)

  if (segments.length === 0) {
    return <Tag className={className}>{'\u00A0'}</Tag>
  }

  return (
    <Tag
      className={cn(
        getVariantBaseClass(variant),
        emojiOnly && getEmojiOnlyClass(variant, emojiCount),
        className,
      )}
    >
      {segments.map((segment, index) =>
        segment.type === 'emoji' ? (
          <span
            key={index}
            className={emojiOnly ? undefined : getInlineEmojiClass(variant)}
          >
            {segment.value}
          </span>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </Tag>
  )
}
