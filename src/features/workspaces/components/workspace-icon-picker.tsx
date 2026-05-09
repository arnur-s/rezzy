import { m } from '@/paraglide/messages'
import { Popover, SearchField } from '@heroui/react'
import { cn } from '@heroui/styles'
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic'
import { CheckIcon, SearchIcon } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { WORKSPACE_CURATED_ICONS } from '../utils/workspace-icons'

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
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-8">
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
    <button
      aria-label={name}
      aria-pressed={isSelected}
      className={cn(
        'group relative flex aspect-square items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition',
        'hover:border-primary/40 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isSelected &&
          'border-primary bg-primary/10 text-primary hover:border-primary',
        isDisabled && 'cursor-not-allowed opacity-50',
      )}
      disabled={isDisabled}
      onClick={() => onSelect(name)}
      type="button"
    >
      <DynamicIcon name={name} className="size-5" />
      {isSelected && (
        <span className="absolute right-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
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
      <Popover.Trigger>
        <button
          className={cn(
            'inline-flex w-fit items-center gap-2 self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition',
            'hover:border-primary/40 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isDisabled && 'cursor-not-allowed opacity-50',
          )}
          disabled={isDisabled}
          type="button"
        >
          <SearchIcon className="size-3.5" />
          {m.workspaces_icon_browse_all()}
        </button>
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
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {m.workspaces_icon_empty()}
            </p>
          ) : (
            <div className="grid max-h-72 grid-cols-6 gap-1.5 overflow-auto pr-1">
              {results.map((name) => (
                <button
                  aria-label={name}
                  aria-pressed={value === name}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-md text-muted-foreground transition',
                    'hover:bg-muted hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    value === name && 'bg-primary/10 text-primary',
                  )}
                  key={name}
                  onClick={() => {
                    onSelect(name)
                    setIsOpen(false)
                  }}
                  type="button"
                >
                  <DynamicIcon name={name} className="size-4" />
                </button>
              ))}
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  )
}
