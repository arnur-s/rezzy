import { Button } from '@/components/button'
import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { FieldError, Input, Label, TextField, toast } from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { ChannelConnectErrorCode } from '../api/channels'
import { ChannelConnectError } from '../api/channels'
import {
  useCreateWhatsappChannel,
  useReconnectWhatsappChannel,
} from '../hooks/use-channels'
import type { EmbeddedSignupReason } from '../lib/whatsapp-embedded-signup'
import {
  EmbeddedSignupError,
  isSecureContextForFbLogin,
  isWhatsappEmbeddedSignupConfigured,
  launchWhatsappEmbeddedSignup,
  preloadWhatsappSdk,
} from '../lib/whatsapp-embedded-signup'
import type { WhatsappChannelFormValues } from '../schemas/channel-form-schemas'
import {
  whatsappChannelDefaultValues,
  whatsappChannelSchema,
} from '../schemas/channel-form-schemas'
import type { WhatsappConnectionTarget } from '../types/whatsapp-connection-target'

type Props = {
  target: WhatsappConnectionTarget
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

function describeConnectError(code: ChannelConnectErrorCode): string {
  switch (code) {
    case 'invalid_token':
      return m.channels_whatsapp_error_invalid()
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

/** Returns a toast description, or null when the failure needs no toast. */
function describeSignupError(reason: EmbeddedSignupReason): string | null {
  switch (reason) {
    case 'cancelled':
      return null
    case 'not_configured':
      return m.channels_whatsapp_not_configured()
    case 'insecure_context':
      return m.channels_whatsapp_requires_https()
    case 'sdk_load_failed':
      return m.channels_whatsapp_error_sdk()
    case 'login_failed':
      return m.channels_whatsapp_error_login()
    case 'timeout':
    case 'missing_session_info':
      return m.channels_whatsapp_error_timeout()
  }
}

export function ConnectWhatsappForm({
  target,
  onCancel,
  onSuccess,
  onDirtyChange,
}: Props) {
  const navigate = useNavigate()
  const createChannelMutation = useCreateWhatsappChannel(target.workspaceId)
  const reconnectChannelMutation = useReconnectWhatsappChannel(
    target.workspaceId,
    target.kind === 'reconnect' ? target.channelId : '',
  )
  const [isConnecting, setIsConnecting] = useState(false)
  const isConfigured = isWhatsappEmbeddedSignupConfigured()
  const isSecure = isSecureContextForFbLogin()
  const canConnect = isConfigured && isSecure

  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = useForm<WhatsappChannelFormValues>({
    defaultValues: whatsappChannelDefaultValues,
    disabled: isConnecting,
    resolver: standardSchemaResolver(whatsappChannelSchema),
  })

  // Keep the parent in sync with unsaved-changes state and always clear it on
  // unmount, so closing or switching channel type resets the confirmation.
  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  // Warm the Facebook SDK up front. Opening the signup popup behind a cold
  // script fetch risks the browser blocking it as non-user-initiated.
  useEffect(() => {
    if (!isConfigured) return
    preloadWhatsappSdk().catch(() => {
      // Reported on click via the sdk_load_failed toast; no need to nag on mount.
    })
  }, [isConfigured])

  async function onSubmit(values: WhatsappChannelFormValues) {
    setIsConnecting(true)
    try {
      const result = await launchWhatsappEmbeddedSignup()
      if (target.kind === 'reconnect') {
        await reconnectChannelMutation.mutateAsync({
          code: result.code,
          phoneNumberId: result.phoneNumberId,
          wabaId: result.wabaId,
        })
      } else {
        await createChannelMutation.mutateAsync({
          code: result.code,
          phoneNumberId: result.phoneNumberId,
          wabaId: result.wabaId,
          name: values.name,
        })
      }
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
    } catch (error) {
      if (error instanceof EmbeddedSignupError) {
        const description = describeSignupError(error.reason)
        if (description) {
          toast.danger(
            target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_error_title()
              : m.channels_create_error_title(),
            { description },
          )
        }
      } else if (error instanceof ChannelConnectError) {
        toast.danger(
          target.kind === 'reconnect'
            ? m.channels_whatsapp_reconnect_error_title()
            : m.channels_create_error_title(),
          {
            description: describeConnectError(error.code),
          },
        )
      } else {
        toast.danger(
          target.kind === 'reconnect'
            ? m.channels_whatsapp_reconnect_error_title()
            : m.channels_create_error_title(),
          {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          },
        )
      }
      // Leave the flow open so the user can retry; success paths unmount instead.
      setIsConnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <ChannelTypeIcon type="whatsapp" size="lg" />
        <div>
          <h2 className="text-lg font-semibold">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_form_title()
              : m.channels_whatsapp_form_title()}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_form_subtitle()
              : m.channels_whatsapp_form_subtitle()}
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {target.kind === 'create' && (
          <TextField
            fullWidth
            isDisabled={isConnecting}
            isInvalid={!!errors.name}
          >
            <Label>{m.channels_name_label()}</Label>
            <Input
              autoFocus
              placeholder={m.channels_whatsapp_name_placeholder()}
              variant="secondary"
              {...register('name')}
            />
            <p className="mt-1.5 text-xs text-muted">
              {m.channels_whatsapp_name_helper()}
            </p>
            <FieldError>{errors.name?.message}</FieldError>
          </TextField>
        )}

        {!isConfigured && (
          <p className="rounded-xl border border-dashed border-muted/30 bg-muted/30 p-4 text-xs text-muted">
            {m.channels_whatsapp_not_configured()}
          </p>
        )}

        {isConfigured && !isSecure && (
          <p className="rounded-xl border border-dashed border-warning/40 bg-warning/10 p-4 text-xs text-muted">
            {m.channels_whatsapp_requires_https()}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-4">
          <Button variant="secondary" onClick={onCancel}>
            {target.kind === 'reconnect' ? m.common_cancel() : m.common_back()}
          </Button>

          <Button
            isDisabled={!canConnect}
            isLoading={isConnecting}
            type="submit"
          >
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_cta()
              : m.channels_whatsapp_connect_cta()}
          </Button>
        </div>
      </form>
    </div>
  )
}
