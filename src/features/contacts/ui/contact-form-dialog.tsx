import { CONTACT_STATUSES, CONTACT_STATUS_META } from '@/entities/contact'
import type { ContactDetail } from '@/entities/contact'
import { useWorkspacePhoneRegion } from '@/features/workspaces/hooks/use-workspace-phone-region'
import { useWorkspaceMemberDirectory } from '@/features/workspaces/hooks/use-workspaces'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { fieldLabel } from '@/lib/field-label'
import { phoneNumbersMatch } from '@/lib/phone-identity'
import { m } from '@/paraglide/messages'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Selector } from '@astryxdesign/core/Selector'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import type { CountryCode } from 'libphonenumber-js'
import { PlusIcon, XIcon } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { MAX_CONTACT_PHONES } from '../api/contact-phones'
import type { ContactPhone } from '../api/contact-phones'
import {
  useContactPhones,
  useCreateContact,
  useUpdateContact,
} from '../hooks/use-contacts'
import {
  createContactFormSchema,
  filledPhones,
  toContactWritePayload,
} from '../model/contact-form-schema'
import type { ContactFormValues } from '../model/contact-form-schema'

type Props = {
  workspaceId: string
  /** null creates a new contact. */
  contact: ContactDetail | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Seeds the fields of a *new* contact, for callers that already know some of
   * the answer — a contact card shared in a conversation, say. Ignored when
   * editing, where the record itself is the source of truth. The user still
   * reviews and saves: prefilling is not creating.
   */
  initialValues?: Partial<ContactFormValues>
  /**
   * Numbers to append to an *edit*, as extra rows below the ones the contact
   * already has. For a caller that knows a number the record does not — a
   * contact card shared in a conversation, matched to someone already in the
   * CRM. Numbers the contact already carries, in any spelling, are dropped
   * rather than added a second time.
   *
   * Seeding rather than saving is the whole point: the rows arrive filled in,
   * and it is still the user who reads them and presses Save.
   */
  additionalPhones?: Array<string>
  /**
   * Replaces the default "go to the new contact" navigation. A caller that
   * opened this dialog from somewhere the user is in the middle of something —
   * an open conversation — passes this to stay put.
   */
  onCreated?: (contact: ContactDetail) => void
}

/**
 * The number rows an edit starts with: the contact's full set when it has been
 * loaded, otherwise the primary alone, so the field is usable before (or
 * without) the phones query resolving.
 */
function toPhoneRows(
  contact: ContactDetail | null,
  phones: Array<ContactPhone> | undefined,
): ContactFormValues['phones'] {
  if (phones && phones.length > 0) {
    return phones.map((entry) => ({ value: entry.phone }))
  }
  const primary = contact?.phone?.trim()
  return primary ? [{ value: primary }] : [{ value: '' }]
}

/**
 * The record's own numbers, followed by the seeded ones it does not carry.
 *
 * Compared with `phoneNumbersMatch` rather than by string equality: the card
 * offers `+77017473004` for a contact that stored `+7 701 747 3004`, and the
 * same number twice in one form is not a correction, it is a mistake the
 * database would then have to collapse.
 */
function withAdditionalPhones(
  rows: ContactFormValues['phones'],
  additional: Array<string>,
): ContactFormValues['phones'] {
  const merged = rows.filter((row) => row.value.trim() !== '')

  for (const candidate of additional) {
    const value = candidate.trim()
    if (!value) continue
    if (merged.some((row) => phoneNumbersMatch(row.value, value))) continue
    merged.push({ value })
  }

  // Every row was blank and nothing was added: the form still needs one field.
  return merged.length > 0 ? merged : [{ value: '' }]
}

function toFormValues(
  contact: ContactDetail | null,
  phones: Array<ContactPhone> | undefined,
  initialValues?: Partial<ContactFormValues>,
  additionalPhones?: Array<string>,
): ContactFormValues {
  const base: ContactFormValues = {
    name: contact?.name ?? '',
    phones: toPhoneRows(contact, phones),
    email: contact?.email ?? '',
    status: (contact?.status ?? 'new') as ContactFormValues['status'],
    ownerId: contact?.owner_id ?? '',
    tags: contact?.tags ?? [],
  }
  // An edit's values are the record's, except for numbers a caller explicitly
  // brought with it — those arrive as extra rows, never as replacements.
  if (contact) {
    return additionalPhones?.length
      ? { ...base, phones: withAdditionalPhones(base.phones, additionalPhones) }
      : base
  }
  const seeded = { ...base, ...initialValues }
  // An empty seeded list would render a form with no phone field at all.
  return seeded.phones.length > 0 ? seeded : { ...seeded, phones: [{ value: '' }] }
}

export function ContactFormDialog({
  workspaceId,
  contact,
  isOpen,
  onOpenChange,
  initialValues,
  additionalPhones,
  onCreated,
}: Props) {
  const showToast = useToast()
  const navigate = useNavigate()
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)
  const phonesQuery = useContactPhones(workspaceId, contact?.id ?? '')
  const regionQuery = useWorkspacePhoneRegion(workspaceId)
  const createContact = useCreateContact(workspaceId)
  const updateContact = useUpdateContact(workspaceId, contact?.id ?? '')
  const isPending = createContact.isPending || updateContact.isPending

  // A contact identified only by a channel handle has no name, phone or email
  // and must stay editable, so the cross-field identity rule is switched off
  // when a channel already identifies it.
  const hasChannelIdentity = (contact?.contact_channels.length ?? 0) > 0
  // A local-format number is only acceptable where a country can be named for
  // it. With no workspace region the field asks for the `+` rather than reading
  // the number as belonging to whichever country the code happened to prefer.
  const region = (regionQuery.data ?? null) as CountryCode | null
  const createSchema = useCallback(
    () => createContactFormSchema({ hasChannelIdentity, region }),
    [hasChannelIdentity, region],
  )
  const schema = useLocalizedSchema(createSchema)

  const { control, formState, handleSubmit, reset } =
    useForm<ContactFormValues>({
      defaultValues: toFormValues(
        contact,
        phonesQuery.data,
        initialValues,
        additionalPhones,
      ),
      disabled: isPending,
      resolver: standardSchemaResolver(schema),
    })

  const phoneRows = useFieldArray({ control, name: 'phones' })

  // Re-baseline each time the dialog opens, so a cancelled edit does not leak
  // into the next one. `initialValues` and `additionalPhones` are read through a
  // ref-like dependency on their serialized form so a caller passing an inline
  // literal does not reset the fields on every render.
  const initialValuesKey = JSON.stringify(initialValues ?? null)
  const additionalPhonesKey = JSON.stringify(additionalPhones ?? null)
  const loadedPhones = phonesQuery.data
  useEffect(() => {
    if (!isOpen) return
    reset(
      toFormValues(
        contact,
        loadedPhones,
        (JSON.parse(initialValuesKey) as Partial<ContactFormValues> | null) ??
          undefined,
        (JSON.parse(additionalPhonesKey) as Array<string> | null) ?? undefined,
      ),
    )
  }, [
    additionalPhonesKey,
    contact,
    initialValuesKey,
    isOpen,
    loadedPhones,
    reset,
  ])

  function onSubmit(values: ContactFormValues) {
    // Belt and braces with the disabled button: a queued Enter keypress must not
    // start a second save while the first is in flight.
    if (isPending) return
    const payload = {
      ...toContactWritePayload(values),
      // The whole set, blanks dropped. `contacts.phone` above is its first
      // entry; both are written together.
      phones: filledPhones(values.phones),
    }

    const onError = () => {
      // The dialog stays open and the fields keep what was typed, so a failed
      // save never costs the user their input.
      showToast({ body: m.contact_form_save_error(), type: 'error' })
    }

    if (contact) {
      updateContact.mutate(payload, {
        onError,
        onSuccess: () => {
          showToast({ body: m.contact_form_updated(), type: 'info' })
          onOpenChange(false)
        },
      })
      return
    }

    createContact.mutate(payload, {
      onError,
      onSuccess: (created) => {
        showToast({ body: m.contact_form_created(), type: 'info' })
        onOpenChange(false)
        if (onCreated) {
          onCreated(created)
          return
        }
        void navigate({
          to: '/workspaces/$id/contacts/$contactId',
          params: { id: workspaceId, contactId: created.id },
        })
      },
    })
  }

  const ownerOptions = [
    { value: '', label: m.contact_form_owner_none() },
    ...(membersQuery.data ?? []).map((member) => ({
      value: member.userId,
      label: member.fullName,
    })),
  ]

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      width={480}
    >
      <DialogHeader
        title={
          contact ? m.contact_form_edit_title() : m.contact_form_create_title()
        }
        onOpenChange={onOpenChange}
      />
      <form
        className="flex flex-col gap-4 px-4 pt-4 pb-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextInput
              label={fieldLabel(
                m.contact_form_name(),
                hasChannelIdentity ? 'optional' : undefined,
              )}
              hasAutoFocus
              value={field.value}
              onChange={(next) => field.onChange(next)}
              onBlur={field.onBlur}
              isDisabled={isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        {/* One row per number the contact can be reached on. The first row is
          the primary — what the directory, the list rows and the inbox panel
          show — which is why the rows are ordered and removable rather than a
          single field plus a bag of extras. */}
        <div className="flex flex-col gap-2">
          {phoneRows.fields.map((row, index) => (
            <div key={row.id} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Controller
                  control={control}
                  name={`phones.${index}.value`}
                  render={({ field, fieldState }) => (
                    <TextInput
                      label={fieldLabel(
                        index === 0
                          ? m.contact_form_phone()
                          : m.contact_form_phone_additional({
                              number: String(index + 1),
                            }),
                        'optional',
                      )}
                      value={field.value}
                      onChange={(next) => field.onChange(next)}
                      onBlur={field.onBlur}
                      isDisabled={isPending}
                      status={
                        fieldState.error?.message
                          ? { type: 'error', message: fieldState.error.message }
                          : undefined
                      }
                    />
                  )}
                />
              </div>
              {phoneRows.fields.length > 1 ? (
                <IconButton
                  variant="ghost"
                  size="sm"
                  // Named with its position, so a screen reader hears which of
                  // several identical controls it is on.
                  label={m.contact_form_phone_remove({
                    number: String(index + 1),
                  })}
                  icon={<XIcon className="size-4" />}
                  isDisabled={isPending}
                  onClick={() => phoneRows.remove(index)}
                />
              ) : null}
            </div>
          ))}
          {phoneRows.fields.length < MAX_CONTACT_PHONES ? (
            <Button
              label={m.contact_form_phone_add()}
              type="button"
              variant="ghost"
              size="sm"
              icon={<PlusIcon className="size-4" aria-hidden />}
              isDisabled={isPending}
              onClick={() => phoneRows.append({ value: '' })}
              className="self-start"
            />
          ) : null}
        </div>

        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <TextInput
              label={fieldLabel(m.contact_form_email(), 'optional')}
              value={field.value}
              onChange={(next) => field.onChange(next)}
              onBlur={field.onBlur}
              isDisabled={isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Selector
              label={m.contact_form_status()}
              value={field.value}
              onChange={(next) => field.onChange(String(next))}
              isDisabled={isPending}
              options={CONTACT_STATUSES.map((status) => ({
                value: status,
                label: CONTACT_STATUS_META[status].labelKey(),
              }))}
            />
          )}
        />

        <Controller
          control={control}
          name="ownerId"
          render={({ field }) => (
            <Selector
              label={m.contact_form_owner()}
              value={field.value}
              onChange={(next) => field.onChange(String(next))}
              isDisabled={isPending}
              options={ownerOptions}
            />
          )}
        />

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            label={m.common_cancel()}
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            isDisabled={isPending}
          />
          <Button
            label={m.common_save()}
            type="submit"
            variant="primary"
            isLoading={isPending}
            isDisabled={isPending || formState.isSubmitting}
          />
        </div>
      </form>
    </Dialog>
  )
}
