import { AtSignIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { ChannelType } from '../model/types'
import {
  InstagramGlyph,
  TelegramGlyph,
  WhatsappGlyph,
} from '../ui/brand-glyphs'

type ChannelMeta = {
  type: ChannelType
  icon: ComponentType<SVGProps<SVGSVGElement>>

  iconClassName: string
  iconBackgroundClassName: string

  comingSoon: boolean
}

export const CHANNEL_META: Record<ChannelType, ChannelMeta> = {
  telegram: {
    type: 'telegram',
    icon: TelegramGlyph,
    iconClassName: 'text-sky-500',
    iconBackgroundClassName: 'bg-sky-500/10',
    comingSoon: false,
  },
  instagram: {
    type: 'instagram',
    icon: InstagramGlyph,
    iconClassName: 'text-pink-500',
    iconBackgroundClassName: 'bg-pink-500/10',
    comingSoon: true,
  },
  whatsapp: {
    type: 'whatsapp',
    icon: WhatsappGlyph,
    iconClassName: 'text-emerald-500',
    iconBackgroundClassName: 'bg-emerald-500/10',
    comingSoon: false,
  },
  email: {
    type: 'email',
    icon: AtSignIcon,
    iconClassName: 'text-amber-500',
    iconBackgroundClassName: 'bg-amber-500/10',
    comingSoon: true,
  },
}
