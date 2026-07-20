import { Button } from '@/components/button'
import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { ChannelConnectErrorCode } from '../api/channels'
import { ChannelConnectError } from '../api/channels'
import {
  useCreateWhatsappChannelManual,
  useReconnectWhatsappChannelManual,
} from '../hooks/use-channels'
import type { WhatsappManualChannelFormValues } from '../schemas/channel-form-schemas'
import {
  whatsappManualChannelDefaultValues,
  whatsappManualChannelSchema,
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

  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = useForm<WhatsappManualChannelFormValues>({
    defaultValues: whatsappManualChannelDefaultValues,
    disabled: isPending,
    resolver: standardSchemaResolver(whatsappManualChannelSchema),
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
        toast.danger(
          target.kind === 'reconnect'
            ? m.channels_whatsapp_reconnect_error_title()
            : m.channels_create_error_title(),
          { description },
        )
      },
      onSuccess: () => {
        toast.success(
          target.kind === 'reconnect'
            ? m.channels_whatsapp_reconnect_success()
            : m.channels_whatsapp_create_success(),
        )
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
          <p className="mt-1 text-sm text-muted-foreground">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_manual_subtitle()
              : m.channels_whatsapp_manual_subtitle()}
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <TextField
          fullWidth
          isDisabled={isPending}
          isInvalid={!!errors.phoneNumberId}
        >
          <Label>{m.channels_whatsapp_phone_number_id_label()}</Label>
          <Input
            autoFocus
            autoComplete="off"
            placeholder="123456789012345"
            spellCheck={false}
            variant="secondary"
            {...register('phoneNumberId')}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {m.channels_whatsapp_phone_number_id_helper()}
          </p>
          <FieldError>{errors.phoneNumberId?.message}</FieldError>
        </TextField>

        <TextField
          fullWidth
          isDisabled={isPending}
          isInvalid={!!errors.accessToken}
        >
          <Label>{m.channels_whatsapp_access_token_label()}</Label>
          <Input
            autoComplete="off"
            placeholder="EAAG..."
            spellCheck={false}
            type="password"
            variant="secondary"
            {...register('accessToken')}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {m.channels_whatsapp_access_token_helper()}
          </p>
          <FieldError>{errors.accessToken?.message}</FieldError>
        </TextField>

        <TextField fullWidth isDisabled={isPending} isInvalid={!!errors.wabaId}>
          <Label>{m.channels_whatsapp_waba_id_label()}</Label>
          <Input
            autoComplete="off"
            placeholder="123456789012345"
            spellCheck={false}
            variant="secondary"
            {...register('wabaId')}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {m.channels_whatsapp_waba_id_helper()}
          </p>
          <FieldError>{errors.wabaId?.message}</FieldError>
        </TextField>

        {target.kind === 'create' && (
          <TextField fullWidth isDisabled={isPending} isInvalid={!!errors.name}>
            <Label>{m.channels_name_label()}</Label>
            <Input
              placeholder={m.channels_whatsapp_name_placeholder()}
              variant="secondary"
              {...register('name')}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </TextField>
        )}

        <div className="flex items-center justify-between gap-2 mt-4">
          <Button variant="secondary" onClick={onBack}>
            {m.common_back()}
          </Button>

          <Button isLoading={isPending} type="submit">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_manual_submit()
              : m.channels_whatsapp_manual_submit()}
          </Button>
        </div>
      </form>
    </div>
  )
}
