import { AppButton } from '@/components/app-button'
import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import {
  Card,
  FieldError,
  InputGroup,
  Label,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Link, useNavigate } from '@tanstack/react-router'
import { DynamicIcon, type IconName } from 'lucide-react/dynamic'
import { ArrowLeftIcon, BuildingIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useCreateWorkspace, useWorkspaces } from '../hooks/use-workspaces'
import {
  createWorkspaceDefaultValues,
  createWorkspaceFormSchema,
  type CreateWorkspaceFormValues,
} from '../schemas/workspace-form-schema'
import { WORKSPACE_DEFAULT_ICON } from '../utils/workspace-icons'
import { WorkspaceIconPicker } from './workspace-icon-picker'

export function CreateWorkspaceForm() {
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
    watch,
  } = useForm<CreateWorkspaceFormValues>({
    defaultValues: createWorkspaceDefaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(createWorkspaceFormSchema),
  })

  const watchedName = watch('name')
  const watchedIcon = watch('icon')
  const previewName = watchedName.trim() || m.workspaces_name_placeholder()

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
        navigate({ params: { id: workspace.id }, to: '/workspaces/$id' })
      },
    })
  }

  return (
    <Card className="w-full max-w-xl border border-border bg-card text-card-foreground shadow-surface z-1">
      <Card.Header className="gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {m.workspaces_setup_kicker()}
        </p>
        <Card.Title>{m.workspaces_setup_title()}</Card.Title>
        <Card.Description>{m.workspaces_setup_description()}</Card.Description>
      </Card.Header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Card.Content className="gap-6">
          <WorkspacePreview
            icon={watchedIcon ?? WORKSPACE_DEFAULT_ICON}
            name={previewName}
          />

          <Controller
            control={control}
            name="icon"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">
                  {m.workspaces_icon_label()}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {m.workspaces_icon_helper()}
                </p>
                <WorkspaceIconPicker
                  isDisabled={isFormDisabled}
                  onChange={field.onChange}
                  value={field.value as IconName | undefined}
                />
                {fieldState.error?.message && (
                  <p className="text-xs text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </div>
            )}
          />

          <TextField
            fullWidth
            isDisabled={isFormDisabled}
            isInvalid={!!errors.name}
          >
            <Label>{m.workspaces_name_label()}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Prefix>
                <BuildingIcon className="size-4" />
              </InputGroup.Prefix>
              <InputGroup.Input
                autoComplete="organization"
                autoFocus
                placeholder={m.workspaces_name_placeholder()}
                {...register('name')}
              />
            </InputGroup>
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
              {...register('description')}
            />
            <FieldError>{errors.description?.message}</FieldError>
          </TextField>
        </Card.Content>

        <Card.Footer className="mt-2 flex-row items-center justify-between gap-3">
          <Link
            to="/workspaces"
            className="link inline-flex items-center gap-2 text-sm"
          >
            <ArrowLeftIcon className="size-4" />
            {m.workspaces_create_cancel()}
          </Link>

          <AppButton
            isDisabled={!userId}
            isLoading={createWorkspaceMutation.isPending}
            type="submit"
          >
            {m.workspaces_create_button()}
          </AppButton>
        </Card.Footer>
      </form>
    </Card>
  )
}

function WorkspacePreview({ icon, name }: { icon: IconName; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <DynamicIcon name={icon} className="size-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">
          {m.workspaces_setup_form_description()}
        </p>
      </div>
    </div>
  )
}
