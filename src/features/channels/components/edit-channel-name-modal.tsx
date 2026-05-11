import { AppButton } from '@/components/app-button'
import { m } from '@/paraglide/messages'
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
  toast,
} from '@heroui/react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  
  editChannelNameSchema
} from '../schemas/channel-form-schemas'
import type {EditChannelNameFormValues} from '../schemas/channel-form-schemas';
import type { Channel } from '../types'
import { useUpdateChannelName } from '../hooks/use-channels'

type Props = {
  channel: Channel
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function EditChannelNameModal({
  channel,
  isOpen,
  onOpenChange,
  workspaceId,
}: Props) {
  const updateChannelMutation = useUpdateChannelName(workspaceId)

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<EditChannelNameFormValues>({
    defaultValues: { name: channel.name ?? '' },
    disabled: updateChannelMutation.isPending,
    resolver: standardSchemaResolver(editChannelNameSchema),
  })

  useEffect(() => {
    if (isOpen) {
      reset({ name: channel.name ?? '' })
    }
  }, [channel.name, isOpen, reset])

  function onSubmit(values: EditChannelNameFormValues) {
    updateChannelMutation.mutate(
      { id: channel.id, name: values.name },
      {
        onError: (error) => {
          toast.danger(m.channels_update_error_title(), {
            description:
              error instanceof Error
                ? error.message
                : m.common_unknown_error(),
          })
        },
        onSuccess: () => {
          toast.success(m.channels_update_success())
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[480px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{m.channels_edit_modal_title()}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form
              className="flex flex-col gap-4 px-4 pt-4 pb-6"
              onSubmit={handleSubmit(onSubmit)}
            >
              <TextField
                fullWidth
                isDisabled={updateChannelMutation.isPending}
                isInvalid={!!errors.name}
              >
                <Label>{m.channels_name_label()}</Label>
                <Input
                  autoFocus
                  placeholder={m.channels_name_placeholder()}
                  variant="secondary"
                  {...register('name')}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </TextField>

              <div className="flex items-center justify-end gap-2 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                >
                  {m.common_cancel()}
                </Button>

                <AppButton
                  isLoading={updateChannelMutation.isPending}
                  type="submit"
                >
                  {m.common_save()}
                </AppButton>
              </div>
            </form>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
