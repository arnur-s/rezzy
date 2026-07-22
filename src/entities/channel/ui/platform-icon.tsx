import { cn } from '@heroui/styles'
import { MailIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { ChannelType } from '../model/types'
import { PLATFORM_META } from '../lib/platform'
import { InstagramGlyph, TelegramGlyph, WhatsappGlyph } from './brand-glyphs'

type Props = {
  type: ChannelType
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Show a tinted background plate around the glyph. */
  withPlate?: boolean
  className?: string
}

const PLATE_SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'size-[18px] [&>svg]:size-3',
  sm: 'size-7 [&>svg]:size-4',
  md: 'size-9 [&>svg]:size-5',
  lg: 'size-11 [&>svg]:size-6',
}

const GLYPH_SIZE: Record<NonNullable<Props['size']>, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
}

export function PlatformIcon({
  type,
  size = 'md',
  withPlate = false,
  className,
}: Props) {
  const meta = PLATFORM_META[type]
  const Glyph = GLYPHS[type]

  if (withPlate) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-xl',
          meta.iconTintClass,
          meta.iconColorClass,
          PLATE_SIZE[size],
          className,
        )}
      >
        <Glyph />
      </span>
    )
  }

  return (
    <Glyph
      aria-hidden
      className={cn(GLYPH_SIZE[size], meta.iconColorClass, className)}
    />
  )
}

const GLYPHS: Record<ChannelType, ComponentType<SVGProps<SVGSVGElement>>> = {
  telegram: TelegramGlyph,
  whatsapp: WhatsappGlyph,
  instagram: InstagramGlyph,
  email: EmailGlyph,
}

function EmailGlyph(props: SVGProps<SVGSVGElement>) {
  return <MailIcon {...props} />
}
