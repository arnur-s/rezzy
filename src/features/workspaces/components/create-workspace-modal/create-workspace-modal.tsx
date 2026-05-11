import { Modal } from '@heroui/react'
import { CreateWorkspaceForm } from '../create-workspace-form'
import { m } from '@/paraglide/messages'

type Props = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkspaceModal({ isOpen, onOpenChange }: Props) {
  function closeModal() {
    onOpenChange(false)
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[600px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{m.workspaces_create_modal_title()}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <CreateWorkspaceForm onCancel={closeModal} onSuccess={closeModal} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
