import { m } from '@/paraglide/messages'
import { TextArea } from '@astryxdesign/core/TextArea'
import { useToast } from '@astryxdesign/core/Toast'
import { useEffect, useState } from 'react'
import { useUpdateContactNotes } from '../../hooks/use-contact'

type Props = {
  contactId: string
  initialNotes: string
}

export function ContactPanelNotes({ contactId, initialNotes }: Props) {
  const [value, setValue] = useState(initialNotes)
  const showToast = useToast()
  const updateNotes = useUpdateContactNotes()

  useEffect(() => {
    setValue(initialNotes)
  }, [contactId, initialNotes])

  function handleBlur() {
    if (value === initialNotes) return
    updateNotes.mutate(
      { contactId, notes: value },
      {
        onError: (error) => {
          showToast({
            body:
              error instanceof Error ? error.message : m.common_unknown_error(),
            type: 'error',
          })
        },
      },
    )
  }

  return (
    <TextArea
      label={m.inbox_contact_panel_notes_label()}
      placeholder={m.inbox_contact_panel_notes_placeholder()}
      rows={4}
      value={value}
      onChange={(next) => setValue(next)}
      onBlur={handleBlur}
    />
  )
}
