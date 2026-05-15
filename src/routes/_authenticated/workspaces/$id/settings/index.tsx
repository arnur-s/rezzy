import { AppButton } from '@/components/app-button'
import { WorkspaceIconPicker } from '@/entities/workspace'
import {
  useUpdateWorkspace,
  useWorkspace,
} from '@/features/workspaces/hooks/use-workspaces'
import type { CreateWorkspaceFormValues } from '@/features/workspaces/schemas/workspace-form-schema'
import { createWorkspaceFormSchema } from '@/features/workspaces/schemas/workspace-form-schema'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import {
  FieldError,
  Input,
  Label,
  Skeleton,
  Surface,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
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
          toast.danger(m.workspace_settings_update_error_title(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          })
        },
        onSuccess: (workspace) => {
          toast.success(m.workspace_settings_update_success())
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
      <Surface
        className="rounded-2xl p-6 text-sm text-danger"
        variant="tertiary"
      >
        {m.workspace_settings_load_error()}
      </Surface>
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
        <p className="mt-1 text-sm text-muted-foreground">
          {m.workspace_settings_general_description()}
        </p>
      </div>

      <Surface className="rounded-2xl p-6" variant="tertiary">
        <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isDisabled={isFormDisabled}
                isInvalid={fieldState.invalid}
              >
                <Label>{m.workspaces_name_label()}</Label>
                <Input
                  autoComplete="organization"
                  placeholder={m.workspaces_name_placeholder()}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isDisabled={isFormDisabled}
                isInvalid={fieldState.invalid}
              >
                <Label>{m.workspaces_description_label()}</Label>
                <TextArea
                  className="min-h-24 w-full resize-y"
                  placeholder={m.workspaces_description_placeholder()}
                  rows={3}
                  name={field.name}
                  ref={field.ref}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />

          <Controller
            control={control}
            name="icon"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">
                  {m.workspaces_icon_label()}
                </Label>
                <WorkspaceIconPicker
                  isDisabled={isFormDisabled}
                  onChange={field.onChange}
                  value={field.value}
                />
                {fieldState.error?.message ? (
                  <p className="text-xs text-destructive">
                    {fieldState.error.message}
                  </p>
                ) : null}
              </div>
            )}
          />

          <div className="flex justify-end">
            <AppButton
              isDisabled={!isDirty}
              isLoading={updateWorkspaceMutation.isPending}
              type="submit"
            >
              {m.common_save_changes()}
            </AppButton>
          </div>
        </form>
      </Surface>
    </div>
  )
}

function GeneralSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="mt-2 h-4 w-full max-w-md rounded" />
      </div>
      <Surface className="space-y-4 rounded-2xl p-6" variant="tertiary">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-24 w-full rounded-md" />
      </Surface>
    </div>
  )
}
