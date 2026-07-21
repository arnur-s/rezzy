import { m } from '@/paraglide/messages'
import { Button, Popover, SearchField } from '@heroui/react'
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
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-8 place-items-center">
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
    <Button
      variant={isSelected ? 'primary' : 'ghost'}
      size="sm"
      isIconOnly
      isDisabled={isDisabled}
      onClick={() => onSelect(name)}
    >
      <DynamicIcon name={name} className="size-5" />
    </Button>
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
    <Popover.Root
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) setQuery('')
      }}
    >
      <Popover.Trigger className="w-fit">
        <Button variant="outline" size="sm" isDisabled={isDisabled}>
          {m.workspaces_icon_browse_all()}
        </Button>
      </Popover.Trigger>

      <Popover.Content className="w-80">
        <Popover.Dialog className="flex flex-col gap-3 p-3">
          <SearchField
            aria-label={m.workspaces_icon_search_placeholder()}
            autoFocus
            onChange={setQuery}
            value={query}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={m.workspaces_icon_search_placeholder()}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {m.workspaces_icon_empty()}
            </p>
          ) : (
            <div className="grid max-h-72 grid-cols-6 gap-1.5 overflow-auto place-items-center">
              {results.map((name) => (
                <Button
                  key={name}
                  variant={value === name ? 'primary' : 'ghost'}
                  size="sm"
                  isDisabled={isDisabled}
                  onClick={() => onSelect(name)}
                  isIconOnly
                >
                  <DynamicIcon name={name} className="size-4" />
                </Button>
              ))}
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  )
}
