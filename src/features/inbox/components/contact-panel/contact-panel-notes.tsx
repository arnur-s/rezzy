import { m } from '@/paraglide/messages'
import { Label, TextArea, TextField, toast } from '@heroui/react'
import { useEffect, useState } from 'react'
import { useUpdateContactNotes } from '../../hooks/use-contact'

type Props = {
  contactId: string
  initialNotes: string
}

export function ContactPanelNotes({ contactId, initialNotes }: Props) {
  const [value, setValue] = useState(initialNotes)
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
          toast.danger(m.inbox_contact_panel_notes_save_error(), {
            description:
              error instanceof Error ? error.message : m.common_unknown_error(),
          })
        },
      },
    )
  }

  return (
    <TextField fullWidth>
      <Label className="text-xs font-medium text-foreground/70">
        {m.inbox_contact_panel_notes_label()}
      </Label>
      <TextArea
        className="min-h-24 w-full resize-y"
        placeholder={m.inbox_contact_panel_notes_placeholder()}
        rows={4}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
      />
    </TextField>
  )
}
