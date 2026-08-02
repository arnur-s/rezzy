import { CONTACT_STATUSES, CONTACT_STATUS_META } from '@/entities/contact'
import type { ContactDetail } from '@/entities/contact'
import { useWorkspaceMemberDirectory } from '@/features/workspaces/hooks/use-workspaces'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { fieldLabel } from '@/lib/field-label'
import { m } from '@/paraglide/messages'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Selector } from '@astryxdesign/core/Selector'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useCreateContact, useUpdateContact } from '../hooks/use-contacts'
import {
  createContactFormSchema,
  toContactWritePayload,
} from '../model/contact-form-schema'
import type { ContactFormValues } from '../model/contact-form-schema'

type Props = {
  workspaceId: string
  /** null creates a new contact. */
  contact: ContactDetail | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

function toFormValues(contact: ContactDetail | null): ContactFormValues {
  return {
    name: contact?.name ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    status: (contact?.status ?? 'new') as ContactFormValues['status'],
    ownerId: contact?.owner_id ?? '',
    tags: contact?.tags ?? [],
  }
}

export function ContactFormDialog({
  workspaceId,
  contact,
  isOpen,
  onOpenChange,
}: Props) {
  const showToast = useToast()
  const navigate = useNavigate()
  const membersQuery = useWorkspaceMemberDirectory(workspaceId)
  const createContact = useCreateContact(workspaceId)
  const updateContact = useUpdateContact(workspaceId, contact?.id ?? '')
  const isPending = createContact.isPending || updateContact.isPending

  // A contact identified only by a channel handle has no name, phone or email
  // and must stay editable, so the cross-field identity rule is switched off
  // when a channel already identifies it.
  const hasChannelIdentity = (contact?.contact_channels.length ?? 0) > 0
  const createSchema = useCallback(
    () => createContactFormSchema({ hasChannelIdentity }),
    [hasChannelIdentity],
  )
  const schema = useLocalizedSchema(createSchema)

  const { control, formState, handleSubmit, reset } =
    useForm<ContactFormValues>({
      defaultValues: toFormValues(contact),
      disabled: isPending,
      resolver: standardSchemaResolver(schema),
    })

  // Re-baseline each time the dialog opens, so a cancelled edit does not leak
  // into the next one.
  useEffect(() => {
    if (isOpen) reset(toFormValues(contact))
  }, [contact, isOpen, reset])

  function onSubmit(values: ContactFormValues) {
    // Belt and braces with the disabled button: a queued Enter keypress must not
    // start a second save while the first is in flight.
    if (isPending) return
    const payload = toContactWritePayload(values)

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

        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <TextInput
              label={fieldLabel(m.contact_form_phone(), 'optional')}
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
