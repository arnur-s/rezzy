import { ChannelTypeIcon } from '@/entities/channel'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { ChannelConnectErrorCode } from '../api/channels'
import { ChannelConnectError } from '../api/channels'
import {
  useCreateWhatsappChannelManual,
  useReconnectWhatsappChannelManual,
} from '../hooks/use-channels'
import type { WhatsappManualChannelFormValues } from '../schemas/channel-form-schemas'
import {
  createWhatsappManualChannelSchema,
  whatsappManualChannelDefaultValues,
} from '../schemas/channel-form-schemas'
import type { WhatsappConnectionTarget } from '../types/whatsapp-connection-target'

type Props = {
  target: WhatsappConnectionTarget
  /** Returns to the Embedded Signup step. */
  onBack: () => void
  onSuccess?: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

function describeConnectError(code: ChannelConnectErrorCode): string {
  switch (code) {
    case 'invalid_token':
      return m.channels_whatsapp_manual_error_invalid()
    case 'missing_permission':
      return m.channels_whatsapp_error_missing_permission()
    case 'phone_mismatch':
      return m.channels_whatsapp_error_phone_mismatch()
    case 'duplicate':
      return m.channels_whatsapp_error_duplicate()
    case 'forbidden':
      return m.channels_whatsapp_error_forbidden()
    case 'unauthorized':
      return m.channels_whatsapp_error_unauthorized()
    default:
      return m.common_unknown_error()
  }
}

export function ConnectWhatsappManualForm({
  target,
  onBack,
  onSuccess,
  onDirtyChange,
}: Props) {
  const navigate = useNavigate()
  const showToast = useToast()
  const createChannelMutation = useCreateWhatsappChannelManual(
    target.workspaceId,
  )
  const reconnectChannelMutation = useReconnectWhatsappChannelManual(
    target.workspaceId,
    target.kind === 'reconnect' ? target.channelId : '',
  )
  const isPending =
    target.kind === 'reconnect'
      ? reconnectChannelMutation.isPending
      : createChannelMutation.isPending
  const schema = useLocalizedSchema(createWhatsappManualChannelSchema)

  const {
    control,
    formState: { isDirty },
    handleSubmit,
  } = useForm<WhatsappManualChannelFormValues>({
    defaultValues: whatsappManualChannelDefaultValues,
    disabled: isPending,
    resolver: standardSchemaResolver(schema),
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  function onSubmit(values: WhatsappManualChannelFormValues) {
    const mutation =
      target.kind === 'reconnect'
        ? reconnectChannelMutation
        : createChannelMutation

    mutation.mutate(values, {
      onError: (error) => {
        const description =
          error instanceof ChannelConnectError
            ? describeConnectError(error.code)
            : error instanceof Error
              ? error.message
              : m.common_unknown_error()
        showToast({ body: description, type: 'error' })
      },
      onSuccess: () => {
        showToast({
          body:
            target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_success()
              : m.channels_whatsapp_create_success(),
          type: 'info',
        })
        if (onSuccess) {
          onSuccess()
          return
        }
        void navigate({
          to: '/workspaces/$id/settings/channels',
          params: { id: target.workspaceId },
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <ChannelTypeIcon type="whatsapp" size="lg" />
        <div>
          <h2 className="text-lg font-semibold">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_manual_title()
              : m.channels_whatsapp_manual_title()}
          </h2>
          <p className="text-secondary mt-1 text-sm">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_manual_subtitle()
              : m.channels_whatsapp_manual_subtitle()}
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Controller
          control={control}
          name="phoneNumberId"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.channels_whatsapp_phone_number_id_label()}
              placeholder="123456789012345"
              description={m.channels_whatsapp_phone_number_id_helper()}
              hasAutoFocus
              value={field.value}
              onChange={(next) => field.onChange(next)}
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
          name="accessToken"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.channels_whatsapp_access_token_label()}
              placeholder="EAAG..."
              description={m.channels_whatsapp_access_token_helper()}
              type="password"
              value={field.value}
              onChange={(next) => field.onChange(next)}
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
          name="wabaId"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.channels_whatsapp_waba_id_label()}
              placeholder="123456789012345"
              description={m.channels_whatsapp_waba_id_helper()}
              value={field.value}
              onChange={(next) => field.onChange(next)}
              isDisabled={isPending}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )}
        />

        {target.kind === 'create' && (
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.channels_name_label()}
                placeholder={m.channels_whatsapp_name_placeholder()}
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isPending}
                status={
                  fieldState.error?.message
                    ? { type: 'error', message: fieldState.error.message }
                    : undefined
                }
              />
            )}
          />
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            label={m.common_back()}
            type="button"
            variant="secondary"
            onClick={onBack}
          />
          <Button
            label={
              target.kind === 'reconnect'
                ? m.channels_whatsapp_reconnect_manual_submit()
                : m.channels_whatsapp_manual_submit()
            }
            type="submit"
            variant="primary"
            isLoading={isPending}
          />
        </div>
      </form>
    </div>
  )
}
