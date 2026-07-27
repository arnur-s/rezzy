import { ChannelTypeIcon } from '@/entities/channel'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
  createWhatsappChannelSchema,
  whatsappChannelDefaultValues,
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
  const showToast = useToast()
  const createChannelMutation = useCreateWhatsappChannel(target.workspaceId)
  const reconnectChannelMutation = useReconnectWhatsappChannel(
    target.workspaceId,
    target.kind === 'reconnect' ? target.channelId : '',
  )
  const [isConnecting, setIsConnecting] = useState(false)
  const isConfigured = isWhatsappEmbeddedSignupConfigured()
  const isSecure = isSecureContextForFbLogin()
  const canConnect = isConfigured && isSecure
  const schema = useLocalizedSchema(createWhatsappChannelSchema)

  const {
    control,
    formState: { isDirty },
    handleSubmit,
  } = useForm<WhatsappChannelFormValues>({
    defaultValues: whatsappChannelDefaultValues,
    disabled: isConnecting,
    resolver: standardSchemaResolver(schema),
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
    } catch (error) {
      if (error instanceof EmbeddedSignupError) {
        const description = describeSignupError(error.reason)
        if (description) showToast({ body: description, type: 'error' })
      } else if (error instanceof ChannelConnectError) {
        showToast({ body: describeConnectError(error.code), type: 'error' })
      } else {
        showToast({
          body:
            error instanceof Error ? error.message : m.common_unknown_error(),
          type: 'error',
        })
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
          <p className="text-secondary mt-1 text-sm">
            {target.kind === 'reconnect'
              ? m.channels_whatsapp_reconnect_form_subtitle()
              : m.channels_whatsapp_form_subtitle()}
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {target.kind === 'create' && (
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextInput
                label={m.channels_name_label()}
                placeholder={m.channels_whatsapp_name_placeholder()}
                description={m.channels_whatsapp_name_helper()}
                hasAutoFocus
                value={field.value}
                onChange={(next) => field.onChange(next)}
                isDisabled={isConnecting}
                status={
                  fieldState.error?.message
                    ? { type: 'error', message: fieldState.error.message }
                    : undefined
                }
              />
            )}
          />
        )}

        {!isConfigured && (
          <p className="border-border/30 bg-muted/30 text-secondary rounded-xl border border-dashed p-4 text-xs">
            {m.channels_whatsapp_not_configured()}
          </p>
        )}

        {isConfigured && !isSecure && (
          <p className="border-warning/40 bg-warning/10 text-secondary rounded-xl border border-dashed p-4 text-xs">
            {m.channels_whatsapp_requires_https()}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            label={target.kind === 'reconnect' ? m.common_cancel() : m.common_back()}
            type="button"
            variant="secondary"
            onClick={onCancel}
          />
          <Button
            label={
              target.kind === 'reconnect'
                ? m.channels_whatsapp_reconnect_cta()
                : m.channels_whatsapp_connect_cta()
            }
            type="submit"
            variant="primary"
            isDisabled={!canConnect}
            isLoading={isConnecting}
          />
        </div>
      </form>
    </div>
  )
}
