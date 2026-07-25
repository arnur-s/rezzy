import { m } from '@/paraglide/messages'
import { TextInput } from '@astryxdesign/core/TextInput'

type Props = {
  value: string
  onChange: (value: string) => void
}

export function ConversationSearch({ value, onChange }: Props) {
  return (
    <div className="w-full px-2">
      <TextInput
        label={m.inbox_search_aria_label()}
        isLabelHidden
        placeholder={m.inbox_search_placeholder()}
        value={value}
        onChange={(next) => onChange(next)}
        hasClear
        size="sm"
      />
    </div>
  )
}
