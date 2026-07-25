import { m } from '@/paraglide/messages'
import { Dialog, DialogHeader  } from '@astryxdesign/core/Dialog'
import { CreateWorkspaceForm } from '../create-workspace-form'

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkspaceModal({ isOpen, onOpenChange }: Props) {
  function closeModal() {
    onOpenChange(false)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      width={600}
    >
      <DialogHeader
        title={m.workspaces_create_modal_title()}
        onOpenChange={onOpenChange}
      />
      <CreateWorkspaceForm onCancel={closeModal} onSuccess={closeModal} />
    </Dialog>
  )
}
