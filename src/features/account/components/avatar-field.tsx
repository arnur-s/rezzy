import { getUserInitials } from '@/entities/user'
import { m } from '@/paraglide/messages'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { useState } from 'react'
import {
  AVATAR_ACCEPT,
  AvatarValidationError,
  MAX_AVATAR_BYTES,
  validateAvatarFile,
} from '../api/avatar'
import type { AvatarRejection } from '../api/avatar'
import { useUpdateAvatar } from '../hooks/use-avatar'

const REJECTION_MESSAGES: Record<AvatarRejection, () => string> = {
  type: () => m.profile_avatar_error_type(),
  size: () => m.profile_avatar_error_size(),
}

type AvatarFieldProps = {
  avatarUrl: string | null
  displayName: string
}

/**
 * Picture on the left, the controls that change it on the right. Uses
 * FileInput's compact `input` mode rather than a dropzone so the whole
 * interaction is a button press — drag-and-drop is never the only route.
 */
export function AvatarField({ avatarUrl, displayName }: AvatarFieldProps) {
  const updateAvatar = useUpdateAvatar()
  const [rejection, setRejection] = useState<AvatarRejection | null>(null)
  const [isRemoved, setIsRemoved] = useState(false)
  const [hasSaved, setHasSaved] = useState(false)

  const isBusy = updateAvatar.isPending

  function apply(file: File | null) {
    setHasSaved(false)
    setIsRemoved(file === null)
    updateAvatar.mutate(file, {
      onSuccess: () => {
        setRejection(null)
        setHasSaved(true)
      },
      onError: (error) => {
        setRejection(
          error instanceof AvatarValidationError ? error.rejection : null,
        )
      },
    })
  }

  function handleChange(files: File | Array<File> | null) {
    const file = Array.isArray(files) ? (files[0] ?? null) : files
    if (!file) return

    const nextRejection = validateAvatarFile(file)
    if (nextRejection) {
      setRejection(nextRejection)
      setHasSaved(false)
      return
    }

    setRejection(null)
    apply(file)
  }

  const status = (() => {
    if (rejection) {
      return { type: 'error' as const, message: REJECTION_MESSAGES[rejection]() }
    }
    if (updateAvatar.isError) {
      return { type: 'error' as const, message: m.profile_avatar_error_upload() }
    }
    if (hasSaved) {
      return {
        type: 'success' as const,
        message: isRemoved
          ? m.profile_avatar_removed()
          : m.profile_avatar_updated(),
      }
    }
    return undefined
  })()

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <Avatar
        size="lg"
        src={avatarUrl ?? undefined}
        name={displayName || getUserInitials(displayName)}
        alt={m.profile_avatar_alt()}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <FileInput
          label={m.profile_avatar_label()}
          description={m.profile_avatar_description()}
          accept={AVATAR_ACCEPT}
          maxSize={MAX_AVATAR_BYTES}
          value={null}
          onChange={handleChange}
          isDisabled={isBusy}
          isLoading={isBusy && !isRemoved}
          placeholder={
            avatarUrl ? m.profile_avatar_replace() : m.profile_avatar_choose()
          }
          status={status}
        />

        {avatarUrl ? (
          // `size="sm"` puts this at 28px, which is a fine mouse target beside
          // the file input and too small for a thumb. Raised on coarse pointers
          // only, so the quiet secondary action stays quiet on the desktop.
          <div className="pointer-coarse:[&_button]:min-h-11">
            <Button
              label={m.profile_avatar_remove()}
              variant="ghost"
              size="sm"
              isDisabled={isBusy}
              isLoading={isBusy && isRemoved}
              onClick={() => apply(null)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
