import { cn } from '@heroui/styles'
import { MailIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { ChannelType } from '../types'
import { PLATFORM_META } from '../utils/platform'

type Props = {
  type: ChannelType
  size?: 'sm' | 'md' | 'lg'
  /** Show a tinted background plate around the glyph. */
  withPlate?: boolean
  className?: string
}

const PLATE_SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'size-7 [&>svg]:size-4',
  md: 'size-9 [&>svg]:size-5',
  lg: 'size-11 [&>svg]:size-6',
}

const GLYPH_SIZE: Record<NonNullable<Props['size']>, string> = {
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

function TelegramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M21.426 2.578a1.5 1.5 0 0 0-1.547-.227L2.83 9.305c-1.075.43-1.054 1.963.034 2.363l4.103 1.51 1.59 5.025a1.165 1.165 0 0 0 1.86.547l2.59-2.117 4.21 3.097a1.5 1.5 0 0 0 2.358-.872l2.945-13.876a1.5 1.5 0 0 0-1.094-1.404Zm-3.45 4.034-7.27 6.564a.75.75 0 0 0-.243.486l-.272 2.477-1.18-3.726a.5.5 0 0 1 .258-.6l8.27-4.616c.42-.235.79.34.437.415Z" />
    </svg>
  )
}

function WhatsappGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.44 1.32 4.93L2 22l5.32-1.4a9.86 9.86 0 0 0 4.72 1.2h.01c5.46 0 9.9-4.45 9.9-9.9 0-2.65-1.03-5.13-2.9-7-1.87-1.87-4.35-2.9-7-2.9Zm5.81 14.13c-.25.7-1.45 1.36-2.02 1.41-.55.05-1.06.27-3.54-.74-2.99-1.21-4.9-4.23-5.04-4.43-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.25.62.85 2.15.92 2.31.07.15.12.34.02.54-.1.2-.15.32-.3.5-.15.18-.31.4-.45.54-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1.01 2.07 1.32 2.36 1.47.3.15.47.13.65-.07.18-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.7.8 1.99.95.29.15.49.22.56.34.07.13.07.7-.18 1.4Z" />
    </svg>
  )
}

function InstagramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function EmailGlyph(props: SVGProps<SVGSVGElement>) {
  return <MailIcon {...props} />
}
