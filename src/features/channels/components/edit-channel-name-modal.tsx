import type { Channel } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useUpdateChannelName } from '../hooks/use-channels'
import type { EditChannelNameFormValues } from '../schemas/channel-form-schemas'
import { editChannelNameSchema } from '../schemas/channel-form-schemas'

type Props = {
  channel: Channel
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function EditChannelNameModal({
  channel,
  isOpen,
  onOpenChange,
  workspaceId,
}: Props) {
  const showToast = useToast()
  const updateChannelMutation = useUpdateChannelName(workspaceId)

  const { control, handleSubmit, reset } = useForm<EditChannelNameFormValues>({
    defaultValues: { name: channel.name ?? '' },
    disabled: updateChannelMutation.isPending,
    resolver: standardSchemaResolver(editChannelNameSchema),
  })

  useEffect(() => {
    if (isOpen) {
      reset({ name: channel.name ?? '' })
    }
  }, [channel.name, isOpen, reset])

  function onSubmit(values: EditChannelNameFormValues) {
    updateChannelMutation.mutate(
      { id: channel.id, name: values.name },
      {
        onError: (error) => {
          showToast({
            body:
              error instanceof Error ? error.message : m.common_unknown_error(),
            type: 'error',
          })
        },
        onSuccess: () => {
          showToast({ body: m.channels_update_success(), type: 'info' })
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      width={480}
    >
      <DialogHeader
        title={m.channels_edit_modal_title()}
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
              label={m.channels_name_label()}
              placeholder={m.channels_name_placeholder()}
              hasAutoFocus
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={updateChannelMutation.isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            label={m.common_cancel()}
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          />
          <Button
            label={m.common_save()}
            type="submit"
            variant="primary"
            isLoading={updateChannelMutation.isPending}
          />
        </div>
      </form>
    </Dialog>
  )
}
