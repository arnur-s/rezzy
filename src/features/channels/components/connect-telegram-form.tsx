import { Button } from '@/components/button'
import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
  const createChannelMutation = useCreateTelegramChannel(workspaceId)

  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
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
          toast.danger(m.channels_create_error_title(), {
            description,
          })
          return
        }
        toast.danger(m.channels_create_error_title(), {
          description:
            error instanceof Error ? error.message : m.common_unknown_error(),
        })
      },
      onSuccess: () => {
        toast.success(m.channels_telegram_create_success())
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
        <TextField
          fullWidth
          isDisabled={createChannelMutation.isPending}
          isInvalid={!!errors.name}
        >
          <Label>{m.channels_name_label()}</Label>
          <Input
            autoFocus
            placeholder={m.channels_telegram_name_placeholder()}
            variant="secondary"
            {...register('name')}
          />
          <FieldError>{errors.name?.message}</FieldError>
        </TextField>

        <TextField
          fullWidth
          isDisabled={createChannelMutation.isPending}
          isInvalid={!!errors.botToken}
        >
          <Label>{m.channels_telegram_token_label()}</Label>
          <Input
            autoComplete="off"
            placeholder={m.channels_telegram_token_placeholder()}
            spellCheck={false}
            variant="secondary"
            {...register('botToken')}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {m.channels_telegram_token_helper()}
          </p>
          <FieldError>{errors.botToken?.message}</FieldError>
        </TextField>

        <div className="flex items-center justify-between gap-2 mt-4">
          <Button variant="secondary" onClick={onCancel}>
            {m.common_back()}
          </Button>

          <Button isLoading={createChannelMutation.isPending} type="submit">
            {m.channels_telegram_submit()}
          </Button>
        </div>
      </form>
    </div>
  )
}
