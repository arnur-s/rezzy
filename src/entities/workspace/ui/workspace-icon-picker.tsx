import { m } from '@/paraglide/messages'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Popover } from '@astryxdesign/core/Popover'
import { TextInput } from '@astryxdesign/core/TextInput'
import type { IconName } from 'lucide-react/dynamic'
import { DynamicIcon, iconNames } from 'lucide-react/dynamic'
import { useDeferredValue, useMemo, useState } from 'react'
import { WORKSPACE_CURATED_ICONS } from '../lib/workspace-icons'

type WorkspaceIconPickerProps = {
  isDisabled?: boolean
  onChange: (value: IconName) => void
  value?: IconName
}

const POPOVER_RESULT_LIMIT = 96

export function WorkspaceIconPicker({
  isDisabled,
  onChange,
  value,
}: WorkspaceIconPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-8 place-items-center gap-2">
        {WORKSPACE_CURATED_ICONS.map((name) => (
          <IconTile
            key={name}
            isDisabled={isDisabled}
            isSelected={value === name}
            name={name}
            onSelect={onChange}
          />
        ))}
      </div>

      <BrowseAllIconsPopover
        isDisabled={isDisabled}
        onSelect={onChange}
        value={value}
      />
    </div>
  )
}

function IconTile({
  isDisabled,
  isSelected,
  name,
  onSelect,
}: {
  isDisabled?: boolean
  isSelected: boolean
  name: IconName
  onSelect: (value: IconName) => void
}) {
  return (
    <IconButton
      label={name}
      icon={<DynamicIcon name={name} className="size-5" />}
      variant={isSelected ? 'primary' : 'ghost'}
      size="sm"
      isDisabled={isDisabled}
      onClick={() => onSelect(name)}
    />
  )
}

function BrowseAllIconsPopover({
  isDisabled,
  onSelect,
  value,
}: {
  isDisabled?: boolean
  onSelect: (value: IconName) => void
  value?: IconName
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    if (!normalized) {
      return iconNames.slice(0, POPOVER_RESULT_LIMIT)
    }

    const matches: Array<IconName> = []

    for (const name of iconNames) {
      if (name.includes(normalized)) {
        matches.push(name)
        if (matches.length >= POPOVER_RESULT_LIMIT) break
      }
    }

    return matches
  }, [deferredQuery])

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) setQuery('')
      }}
      width={320}
      label={m.workspaces_icon_browse_all()}
      // astryx Popover keeps `content` mounted while closed; gate it so the
      // icon grid (~100 buttons) exists only while the picker is open.
      content={
        isOpen ? (
        <div className="flex flex-col gap-3 p-3">
          <TextInput
            label={m.workspaces_icon_search_placeholder()}
            isLabelHidden
            hasAutoFocus
            hasClear
            size="sm"
            placeholder={m.workspaces_icon_search_placeholder()}
            value={query}
            onChange={(next) => setQuery(next)}
          />

          {results.length === 0 ? (
            <p className="text-secondary px-2 py-6 text-center text-sm">
              {m.workspaces_icon_empty()}
            </p>
          ) : (
            <div className="grid max-h-72 grid-cols-6 place-items-center gap-1.5 overflow-auto">
              {results.map((name) => (
                <IconTile
                  key={name}
                  isDisabled={isDisabled}
                  isSelected={value === name}
                  name={name}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
        ) : null
      }
    >
      <Button
        label={m.workspaces_icon_browse_all()}
        variant="secondary"
        size="sm"
        isDisabled={isDisabled}
      />
    </Popover>
  )
}
