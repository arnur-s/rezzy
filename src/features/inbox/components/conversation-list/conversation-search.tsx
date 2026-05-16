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
      value={value}
      onChange={onChange}
      variant="secondary"
      className="px-3 w-full"
    >
      <SearchField.Group className="rounded-lg!">
        <SearchField.SearchIcon />
        <SearchField.Input placeholder={m.inbox_search_placeholder()} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  )
}
