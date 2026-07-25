import { WorkspaceIconPicker } from '@/entities/workspace'
import {
  useUpdateWorkspace,
  useWorkspace,
} from '@/features/workspaces/hooks/use-workspaces'
import type { CreateWorkspaceFormValues } from '@/features/workspaces/schemas/workspace-form-schema'
import { createWorkspaceFormSchema } from '@/features/workspaces/schemas/workspace-form-schema'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@astryxdesign/core/Button'
import { FieldStatus } from '@astryxdesign/core/FieldStatus'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { createFileRoute } from '@tanstack/react-router'
import type { IconName } from 'lucide-react/dynamic'
import { useEffect, useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'

export const Route = createFileRoute(
  '/_authenticated/workspaces/$id/settings/',
)({
  component: RouteComponent,
  staticData: {
    crumb: () => null,
  },
})

function RouteComponent() {
  const { id: workspaceId } = Route.useParams()
  const { session } = useAuth()
  const userId = session?.user.id
  const showToast = useToast()

  const workspaceQuery = useWorkspace(workspaceId)
  const updateWorkspaceMutation = useUpdateWorkspace(userId ?? '')

  const isFormDisabled = updateWorkspaceMutation.isPending

  const {
    control,
    formState: { isDirty },
    handleSubmit,
    reset,
  } = useForm<CreateWorkspaceFormValues>({
    defaultValues: {
      description: '',
      icon: undefined,
      name: '',
    },
    resolver: standardSchemaResolver(createWorkspaceFormSchema),
  })

  const lastSyncedWorkspaceIdRef = useRef<string | null>(null)

  useEffect(() => {
    const row = workspaceQuery.data
    if (!row || row.id !== workspaceId) return

    const workspaceChanged = lastSyncedWorkspaceIdRef.current !== workspaceId
    const values: CreateWorkspaceFormValues = {
      description: row.description ?? '',
      icon: (row.icon as IconName | null) ?? undefined,
      name: row.name,
    }

    if (workspaceChanged) {
      lastSyncedWorkspaceIdRef.current = workspaceId
      reset(values)
      return
    }

    if (!isDirty) {
      reset(values)
    }
  }, [workspaceQuery.data, workspaceId, isDirty, reset])

  function onSubmit(values: CreateWorkspaceFormValues) {
    updateWorkspaceMutation.mutate(
      {
        description: values.description,
        icon: values.icon ?? null,
        id: workspaceId,
        name: values.name,
      },
      {
        onError: (error) => {
          showToast({
            body:
              error instanceof Error ? error.message : m.common_unknown_error(),
            type: 'error',
          })
        },
        onSuccess: (workspace) => {
          showToast({
            body: m.workspace_settings_update_success(),
            type: 'info',
          })
          reset({
            description: workspace.description ?? '',
            icon: (workspace.icon as IconName | null) ?? undefined,
            name: workspace.name,
          })
        },
      },
    )
  }

  if (workspaceQuery.isError) {
    return (
      <div className="text-error text-sm">
        {m.workspace_settings_load_error()}
      </div>
    )
  }

  if (!workspaceQuery.data) {
    return <GeneralSettingsSkeleton />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">
          {m.workspace_settings_general_title()}
        </h2>
        <p className="mt-1 text-sm text-secondary">
          {m.workspace_settings_general_description()}
        </p>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <TextInput
              label={m.workspaces_name_label()}
              placeholder={m.workspaces_name_placeholder()}
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
              {fieldState.error?.message ? (
                <FieldStatus
                  type="error"
                  message={fieldState.error.message}
                  variant="detached"
                />
              ) : null}
            </div>
          )}
        />

        <div className="border-border/60 flex justify-end border-t pt-5">
          <Button
            label={m.common_save_changes()}
            type="submit"
            variant="primary"
            isDisabled={!isDirty}
            isLoading={updateWorkspaceMutation.isPending}
          />
        </div>
      </form>
    </div>
  )
}

function GeneralSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton width={192} height={28} radius={2} />
        <Skeleton width="100%" height={16} radius={2} />
      </div>
      <div className="space-y-5">
        <Skeleton width="100%" height={96} radius={4} />
        <Skeleton width="100%" height={40} radius={3} />
        <Skeleton width="100%" height={96} radius={3} />
      </div>
    </div>
  )
}
