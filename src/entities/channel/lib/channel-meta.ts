import {
  AtSignIcon,
  InstagramIcon,
  MessageCircleIcon,
  SendIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ChannelType } from '../model/types'

type ChannelMeta = {
  type: ChannelType
  icon: LucideIcon

  iconClassName: string
  iconBackgroundClassName: string

  comingSoon: boolean
}

export const CHANNEL_META: Record<ChannelType, ChannelMeta> = {
  telegram: {
    type: 'telegram',
    icon: SendIcon,
    iconClassName: 'text-sky-500',
    iconBackgroundClassName: 'bg-sky-500/10',
    comingSoon: false,
  },
  instagram: {
    type: 'instagram',
    icon: InstagramIcon,
    iconClassName: 'text-pink-500',
    iconBackgroundClassName: 'bg-pink-500/10',
    comingSoon: true,
  },
  whatsapp: {
    type: 'whatsapp',
    icon: MessageCircleIcon,
    iconClassName: 'text-emerald-500',
    iconBackgroundClassName: 'bg-emerald-500/10',
    comingSoon: true,
  },
  email: {
    type: 'email',
    icon: AtSignIcon,
    iconClassName: 'text-amber-500',
    iconBackgroundClassName: 'bg-amber-500/10',
    comingSoon: true,
  },
}
