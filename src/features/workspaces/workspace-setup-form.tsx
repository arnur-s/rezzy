import { AppButton } from '@/components/button'
import { createSlug } from '@/utils/slug'
import { supabase } from '@/utils/supabase'
import {
  Card,
  FieldError,
  InputGroup,
  Label,
  TextField,
  toast,
} from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BriefcaseBusinessIcon, Building2Icon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const workspaceSetupFormSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required.'),
})

type WorkspaceSetupFormValues = z.infer<typeof workspaceSetupFormSchema>

type WorkspaceRecord = {
  id: string
  slug: string
}

const defaultValues: WorkspaceSetupFormValues = {
  name: '',
}

async function createWorkspaceWithUniqueSlug(
  name: string,
  userId: string,
): Promise<WorkspaceRecord> {
  const baseSlug = createSlug(name)
  let lastSlugError: unknown

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        created_by: userId,
        name,
        slug,
      })
      .select('id, slug')
      .single()

    if (!error && data) {
      return data
    }

    if (error?.code === '23505') {
      lastSlugError = error
      continue
    }

    throw error
  }

  throw lastSlugError instanceof Error
    ? lastSlugError
    : new Error('Could not create a unique workspace URL.')
}

export function WorkspaceSetupForm() {
  const navigate = useNavigate()

  const workspaceMutation = useMutation({
    mutationFn: async (values: WorkspaceSetupFormValues) => {
      const name = values.name.trim()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error('You need to be signed in to create a workspace.')
      }

      const workspace = await createWorkspaceWithUniqueSlug(name, user.id)
      const { error: membershipError } = await supabase
        .from('workspace_members')
        .insert({
          role: 'owner',
          user_id: user.id,
          workspace_id: workspace.id,
        })

      if (membershipError) {
        throw membershipError
      }

      return workspace
    },
    onError: (error) => {
      toast.danger('Could not create workspace', {
        description:
          error instanceof Error
            ? error.message
            : 'Check the workspace name and try again.',
      })
    },
    onSuccess: () => {
      navigate({ to: '/dashboard' })
    },
  })

  const isFormDisabled = workspaceMutation.isPending

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceSetupFormValues>({
    defaultValues,
    disabled: isFormDisabled,
    resolver: standardSchemaResolver(workspaceSetupFormSchema),
  })

  function onSubmit(values: WorkspaceSetupFormValues) {
    workspaceMutation.mutate(values)
  }

  return (
    <Card className="w-full max-w-md border border-border bg-card text-card-foreground shadow-surface">
      <Card.Header className="gap-2">
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-primary">
          <BriefcaseBusinessIcon className="size-5" />
        </div>
        <Card.Title>Create your workspace</Card.Title>
        <Card.Description>
          This workspace keeps customers, pipeline, and team activity scoped
          together.
        </Card.Description>
      </Card.Header>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <Card.Content>
          <TextField
            fullWidth
            isDisabled={isFormDisabled}
            isInvalid={!!errors.name}
          >
            <Label>Workspace name</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Prefix>
                <Building2Icon className="size-4" />
              </InputGroup.Prefix>
              <InputGroup.Input
                autoComplete="organization"
                placeholder="Acme Operations"
                {...register('name')}
              />
            </InputGroup>
            <FieldError>{errors.name?.message}</FieldError>
          </TextField>
        </Card.Content>

        <Card.Footer>
          <AppButton type="submit" isLoading={isFormDisabled} fullWidth>
            Create workspace
          </AppButton>
        </Card.Footer>
      </form>
    </Card>
  )
}
