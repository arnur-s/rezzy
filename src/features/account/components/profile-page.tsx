import { m } from '@/paraglide/messages'
import { useAuth } from '@/providers/auth-provider'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useMemo } from 'react'
import { profileFromAuthUser, useMyProfile } from '../hooks/use-my-profile'
import { AvatarField } from './avatar-field'
import { ProfileForm } from './profile-form'
import { WorkspaceMembershipList } from './workspace-membership-list'

export function ProfilePage() {
  const { user } = useAuth()
  const profileQuery = useMyProfile()

  // Memoized so the fallback keeps a stable identity: the form re-baselines
  // itself whenever the profile it was handed changes, and a fresh object on
  // every render would make that fire continuously.
  const fallback = useMemo(
    () => (user ? profileFromAuthUser(user) : null),
    [user],
  )

  if (!user || !fallback) return null

  // A missing row is recoverable: the form seeds one on first save, so it opens
  // on auth metadata rather than on an error.
  const profile = profileQuery.data ?? fallback
  const isFirstLoad = profileQuery.isPending

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-primary text-base font-semibold">
            {m.profile_identity_title()}
          </h2>
          <p className="text-secondary mt-1 text-sm">
            {m.profile_identity_description()}
          </p>
        </div>

        {/* A failed query does not empty the page — the form still opens on
            what auth knows, and the banner says the rest is missing. */}
        {profileQuery.isError ? (
          <Banner
            status="warning"
            title={m.profile_load_error_title()}
            description={m.profile_load_error_description()}
            endContent={
              <Button
                label={m.common_retry()}
                size="sm"
                variant="secondary"
                isLoading={profileQuery.isFetching}
                onClick={() => void profileQuery.refetch()}
              />
            }
          />
        ) : null}

        {isFirstLoad ? (
          <ProfileSkeleton />
        ) : (
          <>
            <AvatarField
              avatarUrl={profile.avatarUrl}
              displayName={profile.fullName}
            />

            <TextInput
              label={m.profile_email_label()}
              description={m.profile_email_description()}
              value={profile.email}
              isDisabled
              disabledMessage={m.profile_email_disabled_reason()}
            />

            <ProfileForm key={profile.id} profile={profile} />
          </>
        )}
      </section>

      <WorkspaceMembershipList />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex items-center gap-4">
        <Skeleton width={48} height={48} radius="rounded" />
        <Skeleton width={220} height={36} radius={2} />
      </div>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex flex-col gap-2">
          <Skeleton width={120} height={12} radius={2} />
          <Skeleton width="100%" height={36} radius={2} />
        </div>
      ))}
    </div>
  )
}
