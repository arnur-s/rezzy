import type { ContactDetail } from '@/entities/contact'
import { setLocale } from '@/paraglide/runtime'
import { renderWithQueryClient } from '@/test/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContactPhone } from '../api/contact-phones'
import { ContactFormDialog } from './contact-form-dialog'

let phones: Array<ContactPhone> | undefined
const update = vi.fn()
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => vi.fn() }))
vi.mock('@/features/workspaces/hooks/use-workspaces', () => ({
  useWorkspaceMemberDirectory: () => ({ data: [] }),
}))
vi.mock('@/features/workspaces/hooks/use-workspace-phone-region', () => ({
  useWorkspacePhoneRegion: () => ({ data: null }),
}))
vi.mock('../hooks/use-contacts', () => ({
  useContactPhones: () => ({ data: phones }),
  useCreateContact: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateContact: () => ({ mutate: update, isPending: false }),
}))

const contact: ContactDetail = {
  id: 'contact-1',
  workspace_id: 'workspace-1',
  name: 'Original name',
  phone: null,
  email: null,
  avatar_url: null,
  status: 'new',
  source: 'manual',
  tags: [],
  owner_id: null,
  last_seen_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  merged_into_id: null,
  merged_at: null,
  merged_by: null,
  contact_channels: [],
}
const onOpenChange = vi.fn()
function dialog(isOpen = true, record = contact) {
  return (
    <ContactFormDialog
      workspaceId="workspace-1"
      contact={record}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}

describe('contact edits while server data arrives', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
    HTMLDialogElement.prototype.close = function () {
      this.open = false
    }
  })
  beforeEach(() => {
    setLocale('en', { reload: false })
    phones = undefined
    vi.clearAllMocks()
  })

  it('keeps typed fields when the phone query finishes and submits the edited value', async () => {
    const view = renderWithQueryClient(dialog())
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Edited name' },
    })
    phones = [
      {
        id: 'phone-1',
        phone: '+77011234567',
        digits: '77011234567',
        position: 0,
      },
    ]
    view.rerender(dialog())

    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe(
      'Edited name',
    )
    expect(screen.getByLabelText<HTMLInputElement>(/Phone/).value).toBe(
      '+77011234567',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Edited name' }),
        expect.anything(),
      ),
    )
  })

  it('discards a cancelled edit when reopening and resets when changing contacts', () => {
    const view = renderWithQueryClient(dialog())
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Unsaved' },
    })
    view.rerender(dialog(false))
    view.rerender(dialog())
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe(
      'Original name',
    )
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Another edit' },
    })
    view.rerender(
      dialog(true, { ...contact, id: 'contact-2', name: 'Second contact' }),
    )
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe(
      'Second contact',
    )
  })
})
