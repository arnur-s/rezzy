import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ChannelConnectError } from '../api/channels'
import { useCreateTelegramChannel } from '../hooks/use-channels'
import type { TelegramChannelFormValues } from '../schemas/channel-form-schemas'
import {
  telegramChannelDefaultValues,
  telegramChannelSchema,
} from '../schemas/channel-form-schemas'

type Props = {
  workspaceId: string
  onCancel: () => void
  /**
   * Called after a channel is created successfully. When provided (e.g. inside
   * the connect modal) it runs instead of navigating to the channels list.
   */
  onSuccess?: () => void
  /**
   * Reports whether the form holds unsaved input so a parent (e.g. the connect
   * modal) can confirm before discarding it on close.
   */
  onDirtyChange?: (isDirty: boolean) => void
}

export function ConnectTelegramForm({
  workspaceId,
  onCancel,
  onSuccess,
  onDirtyChange,
}: Props) {
  const navigate = useNavigate()
  const showToast = useToast()
  const createChannelMutation = useCreateTelegramChannel(workspaceId)

  const {
    control,
    formState: { isDirty },
    handleSubmit,
  } = useForm<TelegramChannelFormValues>({
    defaultValues: telegramChannelDefaultValues,
    disabled: createChannelMutation.isPending,
    resolver: standardSchemaResolver(telegramChannelSchema),
  })

  // Keep the parent in sync with unsaved-changes state and always clear it on
  // unmount, so closing or switching channel type resets the confirmation.
  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function onSubmit(values: TelegramChannelFormValues) {
    createChannelMutation.mutate(values, {
      onError: (error) => {
        if (error instanceof ChannelConnectError) {
          const description =
            error.code === 'invalid_token'
              ? m.channels_telegram_error_invalid_token()
              : error.code === 'duplicate'
                ? m.channels_telegram_error_duplicate()
                : error.code === 'forbidden'
                  ? m.channels_telegram_error_forbidden()
                  : error.code === 'unauthorized'
                    ? m.channels_telegram_error_unauthorized()
                    : m.common_unknown_error()
          showToast({ body: description, type: 'error' })
          return
        }
        showToast({
          body:
            error instanceof Error ? error.message : m.common_unknown_error(),
          type: 'error',
        })
      },
      onSuccess: () => {
        showToast({ body: m.channels_telegram_create_success(), type: 'info' })
        if (onSuccess) {
          onSuccess()
          return
        }
        void navigate({
          to: '/workspaces/$id/settings/channels',
          params: { id: workspaceId },
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <ChannelTypeIcon type="telegram" size="lg" />
        <div>
          <h2 className="text-lg font-semibold">
            {m.channels_telegram_form_title()}
          </h2>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.channels_name_label()}
              placeholder={m.channels_telegram_name_placeholder()}
              hasAutoFocus
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={createChannelMutation.isPending}
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
          name="botToken"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.channels_telegram_token_label()}
              placeholder={m.channels_telegram_token_placeholder()}
              description={m.channels_telegram_token_helper()}
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={createChannelMutation.isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            label={m.common_back()}
            type="button"
            variant="secondary"
            onClick={onCancel}
          />
          <Button
            label={m.channels_telegram_submit()}
            type="submit"
            variant="primary"
            isLoading={createChannelMutation.isPending}
          />
        </div>
      </form>
    </div>
  )
}
