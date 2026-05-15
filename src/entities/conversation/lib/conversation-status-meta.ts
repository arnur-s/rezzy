import { m } from '@/paraglide/messages'
import type { ConversationStatus } from '../model/types'

type StatusMeta = {
  status: ConversationStatus
  labelKey: () => string
  /** HeroUI Chip color. */
  color: 'accent' | 'warning' | 'success' | 'danger' | 'default'
}

export const CONVERSATION_STATUS_META: Record<ConversationStatus, StatusMeta> = {
  open: {
    status: 'open',
    labelKey: () => m.inbox_status_open(),
    color: 'accent',
  },
  closed: {
    status: 'closed',
    labelKey: () => m.inbox_status_closed(),
    color: 'success',
  },
  snoozed: {
    status: 'snoozed',
    labelKey: () => m.inbox_status_snoozed(),
    color: 'warning',
  },
}
