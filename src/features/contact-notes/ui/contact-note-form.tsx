import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { TextArea } from '@astryxdesign/core/TextArea'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useState } from 'react'
import type { Ref } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  CONTACT_NOTE_MAX_LENGTH,
  createContactNoteSchema,
} from '../model/contact-note-schema'
import type { ContactNoteFormValues } from '../model/contact-note-schema'

type Props = {
  initialBody?: string
  label: string
  onCancel?: () => void
  onSave: (values: ContactNoteFormValues) => Promise<void>
  resetOnSuccess?: boolean
  textareaRef?: Ref<HTMLTextAreaElement>
}

export function ContactNoteForm({
  initialBody = '',
  label,
  onCancel,
  onSave,
  resetOnSuccess = false,
  textareaRef,
}: Props) {
  const schema = useLocalizedSchema(createContactNoteSchema)
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
    reset,
  } = useForm<ContactNoteFormValues>({
    defaultValues: { body: initialBody },
    resolver: standardSchemaResolver(schema),
  })
  const [requestError, setRequestError] = useState(false)

  async function submit(values: ContactNoteFormValues) {
    if (isSubmitting) return
    setRequestError(false)

    try {
      await onSave(values)
      if (resetOnSuccess) reset({ body: '' })
    } catch {
      setRequestError(true)
    }
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={handleSubmit(submit)}>
      <Controller
        control={control}
        name="body"
        render={({ field, fieldState }) => (
          <TextArea
            ref={textareaRef}
            label={label}
            value={field.value}
            onChange={(next) => field.onChange(next)}
            onBlur={field.onBlur}
            rows={3}
            size="sm"
            maxLength={CONTACT_NOTE_MAX_LENGTH}
            placeholder={m.contact_notes_composer_placeholder()}
            isDisabled={isSubmitting}
            status={
              fieldState.error?.message
                ? { type: 'error', message: fieldState.error.message }
                : undefined
            }
          />
        )}
      />

      {requestError ? (
        <p className="text-error text-xs" role="alert">
          {m.contact_notes_save_error()}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button
            label={m.common_cancel()}
            size="sm"
            variant="ghost"
            onClick={onCancel}
            isDisabled={isSubmitting}
          />
        ) : null}
        <Button
          label={m.contact_notes_save()}
          size="sm"
          variant={onCancel ? 'secondary' : 'primary'}
          type="submit"
          isLoading={isSubmitting}
          isDisabled={isSubmitting}
        />
      </div>
    </form>
  )
}
