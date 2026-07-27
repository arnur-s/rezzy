import { WorkspaceIconPicker } from '@/entities/workspace'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@astryxdesign/core/Button'
import { FieldStatus } from '@astryxdesign/core/FieldStatus'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { useCreateWorkspace, useWorkspaces } from '../../hooks/use-workspaces'
import type { CreateWorkspaceFormValues } from '../../schemas/workspace-form-schema'
import {
  createWorkspaceDefaultValues,
  createWorkspaceFormSchema,
} from '../../schemas/workspace-form-schema'

type Props = {
  onSuccess: () => void
  onCancel: () => void
}

export function CreateWorkspaceForm({ onSuccess, onCancel }: Props) {
  const navigate = useNavigate()
  const showToast = useToast()
  const { session } = useAuth()
  const userId = session?.user.id

  const workspacesQuery = useWorkspaces(userId)
  const hasMainWorkspace =
    workspacesQuery.data?.some((workspace) => workspace.is_main) ?? false

  const createWorkspaceMutation = useCreateWorkspace({
    hasMainWorkspace,
    userId: userId ?? '',
  })

  const isFormDisabled = createWorkspaceMutation.isPending || !userId
  const schema = useLocalizedSchema(createWorkspaceFormSchema)

  const { control, handleSubmit } = useForm<CreateWorkspaceFormValues>({
    defaultValues: createWorkspaceDefaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(schema),
  })

  function onSubmit(values: CreateWorkspaceFormValues) {
    if (!userId) return

    createWorkspaceMutation.mutate(values, {
      onError: (error) => {
        showToast({
          body:
            error instanceof Error ? error.message : m.common_unknown_error(),
          type: 'error',
        })
      },
      onSuccess: (workspace) => {
        showToast({ body: m.workspaces_create_success(), type: 'info' })
        onSuccess()
        void navigate({
          to: '/workspaces/$id/settings/channels',
          params: { id: workspace.id },
        })
      },
    })
  }

  return (
    <form
      className="flex flex-col gap-4 px-4 pt-6 overflow-y-auto"
      onSubmit={handleSubmit(onSubmit)}
    >
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextInput
            label={m.workspaces_name_label()}
            placeholder={m.workspaces_name_placeholder()}
            hasAutoFocus
            value={field.value}
            onChange={(next) => field.onChange(next)}
            isDisabled={isFormDisabled}
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
        name="description"
        render={({ field, fieldState }) => (
          <TextArea
            label={m.workspaces_description_label()}
            placeholder={m.workspaces_description_placeholder()}
            rows={3}
            value={field.value ?? ''}
            onChange={(next) => field.onChange(next)}
            isDisabled={isFormDisabled}
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
        name="icon"
        render={({ field, fieldState }) => (
          <div className="flex flex-col gap-2">
            <Text as="label" type="label">
              {m.workspaces_icon_label()}
            </Text>
            <WorkspaceIconPicker
              isDisabled={isFormDisabled}
              onChange={field.onChange}
              value={field.value}
            />
            {fieldState.error?.message && (
              <FieldStatus
                type="error"
                message={fieldState.error.message}
                variant="detached"
              />
            )}
          </div>
        )}
      />

      <div className="mt-6 flex items-center justify-between gap-2">
        <Button
          label={m.common_cancel()}
          type="button"
          variant="secondary"
          onClick={onCancel}
        />

        <Button
          label={m.common_create()}
          type="submit"
          variant="primary"
          isDisabled={!userId}
          isLoading={createWorkspaceMutation.isPending}
        />
      </div>
    </form>
  )
}
