import { IconButton } from '@astryxdesign/core/IconButton'
import type { WorkspaceIconName } from '../lib/workspace-icons'
import { WORKSPACE_CURATED_ICONS } from '../lib/workspace-icons'
import { WorkspaceIcon } from './workspace-icon'

type WorkspaceIconPickerProps = {
  isDisabled?: boolean
  onChange: (value: WorkspaceIconName) => void
  value?: string | null
}

/**
 * Picks from the curated set only.
 *
 * The previous version also offered a searchable browse over every Lucide icon.
 * That single affordance imported `lucide-react/dynamic`'s icon map, which cost
 * 158 kB gzip on every page in the app — including sign-in, which has no
 * workspace and no picker. Sixteen well-chosen options are a better picker than
 * 1600 unbrowsable ones, and now they cost only what they draw.
 */
export function WorkspaceIconPicker({
  isDisabled,
  onChange,
  value,
}: WorkspaceIconPickerProps) {
  return (
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
  name: WorkspaceIconName
  onSelect: (value: WorkspaceIconName) => void
}) {
  return (
    <IconButton
      label={name}
      icon={<WorkspaceIcon name={name} className="size-5" />}
      variant={isSelected ? 'primary' : 'ghost'}
      size="sm"
      isDisabled={isDisabled}
      onClick={() => onSelect(name)}
    />
  )
}
