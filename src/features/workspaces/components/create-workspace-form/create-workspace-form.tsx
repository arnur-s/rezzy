import { AppButton } from '@/components/app-button'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import {
  Button,
  FieldError,
  Input,
  Label,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useNavigate } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { useCreateWorkspace, useWorkspaces } from '../../hooks/use-workspaces'
import type { CreateWorkspaceFormValues } from '../../schemas/workspace-form-schema'
import {
  createWorkspaceDefaultValues,
  createWorkspaceFormSchema,
} from '../../schemas/workspace-form-schema'
import { WorkspaceIconPicker } from '../workspace-icon-picker'

type Props = {
  onSuccess: () => void
  onCancel: () => void
}

export function CreateWorkspaceForm({ onSuccess, onCancel }: Props) {
  const navigate = useNavigate()
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

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CreateWorkspaceFormValues>({
    defaultValues: createWorkspaceDefaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(createWorkspaceFormSchema),
  })

  function onSubmit(values: CreateWorkspaceFormValues) {
    if (!userId) return

    createWorkspaceMutation.mutate(values, {
      onError: (error) => {
        toast.danger(m.workspaces_create_error_title(), {
          description:
            error instanceof Error ? error.message : m.common_unknown_error(),
        })
      },
      onSuccess: (workspace) => {
        toast.success(m.workspaces_create_success())
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
      className="flex flex-col gap-4 px-4 pt-6"
      onSubmit={handleSubmit(onSubmit)}
    >
      <TextField
        fullWidth
        isDisabled={isFormDisabled}
        isInvalid={!!errors.name}
      >
        <Label>{m.workspaces_name_label()}</Label>
        <Input
          autoComplete="organization"
          autoFocus
          placeholder={m.workspaces_name_placeholder()}
          variant="secondary"
          {...register('name')}
        />
        <FieldError>{errors.name?.message}</FieldError>
      </TextField>

      <TextField
        fullWidth
        isDisabled={isFormDisabled}
        isInvalid={!!errors.description}
      >
        <Label>{m.workspaces_description_label()}</Label>
        <TextArea
          className="min-h-24 w-full resize-y"
          placeholder={m.workspaces_description_placeholder()}
          rows={3}
          variant="secondary"
          {...register('description')}
        />
        <FieldError>{errors.description?.message}</FieldError>
      </TextField>

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
            {fieldState.error?.message && (
              <p className="text-xs text-destructive">
                {fieldState.error.message}
              </p>
            )}
          </div>
        )}
      />

      <div className="flex items-center justify-between gap-2 mt-6">
        <Button variant="secondary" onClick={onCancel}>
          {m.common_cancel()}
        </Button>

        <AppButton
          isDisabled={!userId}
          isLoading={createWorkspaceMutation.isPending}
          type="submit"
        >
          {m.common_create()}
        </AppButton>
      </div>
    </form>
  )
}
