import { m } from '@/paraglide/messages'
import type { ChannelType } from '../types'

type PlatformMeta = {
  type: ChannelType
  labelKey: () => string
  /** Tailwind text color matching the brand */
  iconColorClass: string
  /** Tailwind background tint for icon chips */
  iconTintClass: string
}

export const PLATFORM_META: Record<ChannelType, PlatformMeta> = {
  telegram: {
    type: 'telegram',
    labelKey: () => m.inbox_filter_telegram(),
    iconColorClass: 'text-[#26A5E4]',
    iconTintClass: 'bg-[#26A5E4]/10',
  },
  whatsapp: {
    type: 'whatsapp',
    labelKey: () => m.inbox_filter_whatsapp(),
    iconColorClass: 'text-[#25D366]',
    iconTintClass: 'bg-[#25D366]/10',
  },
  instagram: {
    type: 'instagram',
    labelKey: () => m.inbox_filter_instagram(),
    iconColorClass: 'text-[#E1306C]',
    iconTintClass: 'bg-[#E1306C]/10',
  },
  email: {
    type: 'email',
    labelKey: () => m.inbox_filter_email(),
    iconColorClass: 'text-foreground/60',
    iconTintClass: 'bg-foreground/5',
  },
}
