import { m } from '@/paraglide/messages'
import { SearchField } from '@heroui/react'

type Props = {
  value: string
  onChange: (value: string) => void
}

export function ConversationSearch({ value, onChange }: Props) {
  return (
    <SearchField
      aria-label={m.inbox_search_aria_label()}
      className="p-3"
      value={value}
      onChange={onChange}
      variant="secondary"
    >
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={m.inbox_search_placeholder()} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  )
}
