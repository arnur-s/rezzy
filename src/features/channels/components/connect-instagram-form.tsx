import { ChannelTypeIcon } from '@/entities/channel'
import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { ChannelConnectErrorCode } from '../api/channels'
import { ChannelConnectError, beginInstagramOAuth } from '../api/channels'
import {
  useCreateInstagramChannel,
  useReconnectInstagramChannel,
} from '../hooks/use-channels'
import type { InstagramOAuthReason } from '../lib/instagram-oauth'
import {
  InstagramOAuthError,
  isInstagramOAuthConfigured,
  isSecureContextForInstagramLogin,
  launchInstagramOAuth,
} from '../lib/instagram-oauth'
import type { InstagramChannelFormValues } from '../schemas/channel-form-schemas'
import {
  instagramChannelDefaultValues,
  instagramChannelSchema,
} from '../schemas/channel-form-schemas'
import type { InstagramConnectionTarget } from '../types/instagram-connection-target'

type Props = {
  target: InstagramConnectionTarget
  onCancel: () => void
  onSuccess?: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

function describeConnectError(code: ChannelConnectErrorCode): string {
  switch (code) {
    case 'invalid_code':
    case 'invalid_token':
      return m.channels_instagram_error_invalid_code()
    case 'missing_permission':
      return m.channels_instagram_error_missing_permission()
    case 'not_professional':
      return m.channels_instagram_error_not_professional()
    case 'account_mismatch':
      return m.channels_instagram_error_account_mismatch()
    case 'duplicate':
      return m.channels_instagram_error_duplicate()
    case 'state_mismatch':
      return m.channels_instagram_error_state_mismatch()
    case 'forbidden':
      return m.channels_instagram_error_forbidden()
    case 'unauthorized':
      return m.channels_instagram_error_unauthorized()
    default:
      return m.common_unknown_error()
  }
}

/** Returns a toast description, or null when the failure needs no toast. */
function describeOAuthError(reason: InstagramOAuthReason): string | null {
  switch (reason) {
    case 'cancelled':
      return null
    case 'not_configured':
      return m.channels_instagram_not_configured()
    case 'insecure_context':
      return m.channels_instagram_requires_https()
    case 'popup_blocked':
      return m.channels_instagram_error_popup_blocked()
    case 'state_mismatch':
      return m.channels_instagram_error_state_mismatch()
    case 'timeout':
      return m.channels_instagram_error_timeout()
    case 'oauth_error':
      return m.channels_instagram_error_oauth()
  }
}

export function ConnectInstagramForm({
  target,
  onCancel,
  onSuccess,
  onDirtyChange,
}: Props) {
  const navigate = useNavigate()
  const showToast = useToast()
  const createChannelMutation = useCreateInstagramChannel(target.workspaceId)
  const reconnectChannelMutation = useReconnectInstagramChannel(
    target.workspaceId,
    target.kind === 'reconnect' ? target.channelId : '',
  )
  const [isConnecting, setIsConnecting] = useState(false)
  const isConfigured = isInstagramOAuthConfigured()
  const isSecure = isSecureContextForInstagramLogin()
  const canConnect = isConfigured && isSecure

  const {
    control,
    formState: { isDirty },
    handleSubmit,
  } = useForm<InstagramChannelFormValues>({
    defaultValues: instagramChannelDefaultValues,
    disabled: isConnecting,
    resolver: standardSchemaResolver(instagramChannelSchema),
  })

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => onDirtyChange?.(false)
  }, [isDirty, onDirtyChange])

  async function onSubmit(values: InstagramChannelFormValues) {
    setIsConnecting(true)
    try {
      const result = await launchInstagramOAuth({
        getState: () =>
          beginInstagramOAuth({
            workspaceId: target.workspaceId,
            channelId:
              target.kind === 'reconnect' ? target.channelId : undefined,
          }),
      })
      if (target.kind === 'reconnect') {
        await reconnectChannelMutation.mutateAsync({
          code: result.code,
          state: result.state,
        })
      } else {
        await createChannelMutation.mutateAsync({
          code: result.code,
          state: result.state,
          name: values.name,
        })
      }
      showToast({
        body:
          target.kind === 'reconnect'
            ? m.channels_instagram_reconnect_success()
            : m.channels_instagram_create_success(),
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
      if (error instanceof InstagramOAuthError) {
        const description = describeOAuthError(error.reason)
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
        <ChannelTypeIcon type="instagram" size="lg" />
        <div>
          <h2 className="text-lg font-semibold">
            {target.kind === 'reconnect'
              ? m.channels_instagram_reconnect_form_title()
              : m.channels_instagram_form_title()}
          </h2>
          <p className="text-secondary mt-1 text-sm">
            {target.kind === 'reconnect'
              ? m.channels_instagram_reconnect_form_subtitle()
              : m.channels_instagram_form_subtitle()}
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
                placeholder={m.channels_instagram_name_placeholder()}
                description={m.channels_instagram_name_helper()}
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

        <p className="border-border/30 bg-muted/30 text-secondary rounded-xl border border-dashed p-4 text-xs">
          {m.channels_instagram_requirement()}
        </p>

        {!isConfigured && (
          <p className="border-border/30 bg-muted/30 text-secondary rounded-xl border border-dashed p-4 text-xs">
            {m.channels_instagram_not_configured()}
          </p>
        )}

        {isConfigured && !isSecure && (
          <p className="border-warning/40 bg-warning/10 text-secondary rounded-xl border border-dashed p-4 text-xs">
            {m.channels_instagram_requires_https()}
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
                ? m.channels_instagram_reconnect_cta()
                : m.channels_instagram_connect_cta()
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
