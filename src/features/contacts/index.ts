export { getWorkspaceContact } from './api/contacts'
export type { ContactListPage, ContactWritePayload } from './api/contacts'
export { matchWorkspaceContacts } from './api/contact-matches'
export type { ContactMatch, ContactMatchReason } from './api/contact-matches'
export {
  MAX_CONTACT_PHONES,
  listContactPhones,
  setContactPhones,
} from './api/contact-phones'
export type { ContactPhone } from './api/contact-phones'
export { contactQueryKeys } from './api/query-keys'
export { useContactMatches } from './hooks/use-contact-matches'
export {
  useContactConversations,
  useContactDetail,
  useContactList,
  useContactPhones,
  useCreateContact,
  useUpdateContact,
} from './hooks/use-contacts'
export type { ContactWriteInput } from './hooks/use-contacts'
export {
  EMPTY_CONTACT_IDENTITY,
  contactIdentityFromSharedContact,
  contactIdentityKey,
  hasContactIdentity,
} from './model/contact-identity'
export type { ContactIdentityLookup } from './model/contact-identity'
export {
  createContactFormSchema,
  filledPhones,
  toContactWritePayload,
} from './model/contact-form-schema'
export type { ContactFormValues } from './model/contact-form-schema'
export {
  CONTACTS_PAGE_SIZE,
  DEFAULT_CONTACT_SORT,
  EMPTY_CONTACT_LIST_PARAMS,
  hasActiveContactFilters,
} from './model/contact-list-params'
export type { ContactListParams } from './model/contact-list-params'
export { ContactDetailPage } from './ui/contact-detail-page'
export { ContactFormDialog } from './ui/contact-form-dialog'
export { ContactsPage } from './ui/contacts-page'
