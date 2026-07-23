import { m } from '@/paraglide/messages'
import {
  CheckCheckIcon,
  CheckIcon,
  HeadphonesIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import type { MessageStatus, MessageType } from '../model/types'

type MessageStatusMeta = {
  status: MessageStatus
  labelKey: () => string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Tailwind text color for the icon. */
  className: string
}

/**
 * Per spec: outbound delivery indicators show sent / delivered / read / failed.
 */
export const MESSAGE_STATUS_META: Record<MessageStatus, MessageStatusMeta> = {
  sent: {
    status: 'sent',
    labelKey: () => m.inbox_message_status_sent(),
    Icon: CheckIcon,
    className: 'opacity-70',
  },
  delivered: {
    status: 'delivered',
    labelKey: () => m.inbox_message_status_delivered(),
    Icon: CheckCheckIcon,
    className: 'opacity-70',
  },
  read: {
    status: 'read',
    labelKey: () => m.inbox_message_status_read(),
    Icon: CheckCheckIcon,
    className: 'text-info',
  },
  played: {
    status: 'played',
    labelKey: () => m.inbox_message_status_played(),
    Icon: HeadphonesIcon,
    className: 'text-info',
  },
  failed: {
    status: 'failed',
    labelKey: () => m.inbox_message_status_failed(),
    Icon: TriangleAlertIcon,
    className: 'text-danger',
  },
}

/** Default placeholder text for a media message when no caption is present. */
export function getMediaPlaceholder(type: MessageType): string {
  switch (type) {
    case 'image':
      return m.inbox_message_type_image()
    case 'video':
      return m.inbox_message_type_video()
    case 'audio':
      return m.inbox_message_type_audio()
    case 'voice':
      return m.inbox_message_type_voice()
    case 'document':
      return m.inbox_message_type_document()
    case 'sticker':
      return m.inbox_message_type_sticker()
    case 'location':
      return m.inbox_message_type_location()
    case 'contact':
      return m.inbox_message_type_contact()
    case 'interactive':
      return m.inbox_message_type_interactive()
    case 'share':
      return m.inbox_message_type_share()
    case 'story_reply':
      return m.inbox_message_type_story_reply()
    case 'story_mention':
      return m.inbox_message_type_story_mention()
    case 'system':
      return m.inbox_message_type_system()
    case 'unsupported':
      return m.inbox_message_type_unsupported()
    case 'text':
      return m.inbox_media_placeholder()
  }
}
