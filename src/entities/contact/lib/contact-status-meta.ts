import { m } from '@/paraglide/messages'
import type { ContactSource, ContactStatus } from '../model/types'

type StatusMeta = {
  status: ContactStatus
  labelKey: () => string
  /** Semantic status color, mapped to an Astryx Badge variant in the UI. */
  color: 'accent' | 'warning' | 'success' | 'danger' | 'default'
}

export const CONTACT_STATUS_META: Record<ContactStatus, StatusMeta> = {
  new: {
    status: 'new',
    labelKey: () => m.contact_status_new(),
    color: 'accent',
  },
  in_progress: {
    status: 'in_progress',
    labelKey: () => m.contact_status_in_progress(),
    color: 'warning',
  },
  done: {
    status: 'done',
    labelKey: () => m.contact_status_done(),
    color: 'success',
  },
  lost: {
    status: 'lost',
    labelKey: () => m.contact_status_lost(),
    color: 'default',
  },
}

export const CONTACT_SOURCE_META: Record<
  ContactSource,
  { source: ContactSource; labelKey: () => string }
> = {
  whatsapp: { source: 'whatsapp', labelKey: () => m.contact_source_whatsapp() },
  instagram: {
    source: 'instagram',
    labelKey: () => m.contact_source_instagram(),
  },
  telegram: { source: 'telegram', labelKey: () => m.contact_source_telegram() },
  email: { source: 'email', labelKey: () => m.contact_source_email() },
  manual: { source: 'manual', labelKey: () => m.contact_source_manual() },
}
