import { fieldLabel } from '@/lib/field-label'
import { useLocalizedSchema } from '@/hooks/use-localized-schema'
import { m } from '@/paraglide/messages'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import {
  Typeahead,
  TypeaheadItem,
  createStaticSource,
} from '@astryxdesign/core/Typeahead'
import type { SearchableItem } from '@astryxdesign/core/Typeahead'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { CheckIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useUpdateMyProfile } from '../hooks/use-my-profile'
import { useNativeInputAttrs } from '../lib/native-input-attrs'
import { formatPhoneAsYouType, fromE164 } from '../lib/phone'
import {
  formatTimeZoneLabel,
  formatTimeZoneOffset,
  listTimeZones,
} from '../lib/time-zones'
import type { UserProfile } from '../model/types'
import {
  createProfileFormSchema,
  toProfileIdentityInput,
} from '../schemas/profile-form-schema'
import type { ProfileFormValues } from '../schemas/profile-form-schema'

function toFormValues(profile: UserProfile): ProfileFormValues {
  return {
    fullName: profile.fullName,
    jobTitle: profile.jobTitle ?? '',
    // Stored E.164 is one long digit run; the field shows it grouped.
    phone: fromE164(profile.phone),
    timezone: profile.timezone ?? '',
  }
}

/**
 * Labels only. The UTC offset is resolved in `renderItem` instead, so the
 * several hundred zones in the list cost nothing until they are on screen.
 */
function useTimeZoneItems() {
  return useMemo(
    () =>
      listTimeZones().map<SearchableItem>((zone) => ({
        id: zone,
        label: formatTimeZoneLabel(zone),
      })),
    [],
  )
}

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const updateProfile = useUpdateMyProfile()
  const [hasSaved, setHasSaved] = useState(false)

  const schema = useLocalizedSchema(createProfileFormSchema)

  const timeZoneItems = useTimeZoneItems()
  const timeZoneSource = useMemo(
    () => createStaticSource(timeZoneItems),
    [timeZoneItems],
  )

  const isPending = updateProfile.isPending

  // Astryx doesn't type `autocomplete`, `inputmode`, or `type="tel"`, so these
  // ride in on the ref it forwards to the real input. Held at component level
  // rather than inside each `Controller` render prop, which would put hook
  // calls in a callback React may not invoke on every render.
  // `aria-required` rides in on the ref because Astryx's `isRequired` also
  // prints the English word "Required" beside the label; `fieldLabel` writes
  // that marker from the app's own catalogue instead.
  const fullNameAttrs = useNativeInputAttrs({
    autoComplete: 'name',
    required: true,
  })
  const jobTitleAttrs = useNativeInputAttrs({
    autoComplete: 'organization-title',
  })
  const phoneAttrs = useNativeInputAttrs({
    autoComplete: 'tel',
    inputMode: 'tel',
    type: 'tel',
  })

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<ProfileFormValues>({
    defaultValues: toFormValues(profile),
    resolver: standardSchemaResolver(schema),
    disabled: isPending,
  })

  // A background refetch can land while the form is idle. Reset then, so the
  // fields follow the server, but never mid-edit: the user's typing wins.
  useEffect(() => {
    if (isDirty || isPending) return
    reset(toFormValues(profile), { keepDefaultValues: false })
  }, [profile, isDirty, isPending, reset])

  function onSubmit(values: ProfileFormValues) {
    // Belt and braces with the disabled button: a queued Enter keypress must
    // not start a second save while the first is in flight.
    if (isPending) return

    const input = toProfileIdentityInput(values)

    updateProfile.mutate(input, {
      onSuccess: (saved) => {
        setHasSaved(true)
        // Re-baseline so the form is clean again and Save disables itself.
        reset(toFormValues(saved))
      },
    })
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={handleSubmit(onSubmit)}
      onChange={() => setHasSaved(false)}
    >
      <Controller
        control={control}
        name="fullName"
        render={({ field, fieldState }) => (
          <TextInput
            label={fieldLabel(m.profile_full_name_label(), 'required')}
            ref={fullNameAttrs}
            value={field.value}
            onChange={(next) => field.onChange(next)}
            isDisabled={isPending}
            status={
              fieldState.error?.message
                ? { type: 'error', message: fieldState.error.message }
                : undefined
            }
          />
        )}
      />

      <Controller
        control={control}
        name="jobTitle"
        render={({ field, fieldState }) => (
          <TextInput
            label={fieldLabel(m.profile_job_title_label(), 'optional')}
            placeholder={m.profile_job_title_placeholder()}
            ref={jobTitleAttrs}
            value={field.value}
            onChange={(next) => field.onChange(next)}
            isDisabled={isPending}
            status={
              fieldState.error?.message
                ? { type: 'error', message: fieldState.error.message }
                : undefined
            }
          />
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <TextInput
            label={fieldLabel(m.profile_phone_label(), 'optional')}
            description={m.profile_phone_description()}
            placeholder={m.profile_phone_placeholder()}
            ref={phoneAttrs}
            value={field.value}
            // Masked on the way in, so the field always reads the way the
            // number will be stored rather than however it was typed.
            onChange={(next) => field.onChange(formatPhoneAsYouType(next))}
            isDisabled={isPending}
            status={
              fieldState.error?.message
                ? { type: 'error', message: fieldState.error.message }
                : undefined
            }
          />
        )}
      />

      <Controller
        control={control}
        name="timezone"
        render={({ field, fieldState }) => {
          const selected =
            timeZoneItems.find((item) => item.id === field.value) ?? null

          return (
            <Typeahead
              label={fieldLabel(m.profile_timezone_label(), 'optional')}
              description={m.profile_timezone_description()}
              placeholder={m.profile_timezone_placeholder()}
              hasEntriesOnFocus
              debounceMs={0}
              searchSource={timeZoneSource}
              value={selected}
              onChange={(item) => field.onChange(item?.id ?? '')}
              renderItem={(item) => (
                <TypeaheadItem
                  item={item}
                  description={formatTimeZoneOffset(item.id)}
                />
              )}
              isDisabled={isPending || timeZoneItems.length === 0}
              disabledMessage={
                timeZoneItems.length === 0
                  ? m.profile_timezone_unsupported()
                  : undefined
              }
              emptySearchResultsText={m.profile_timezone_no_results()}
              status={
                fieldState.error?.message
                  ? { type: 'error', message: fieldState.error.message }
                  : undefined
              }
            />
          )
        }}
      />

      {updateProfile.isError ? (
        <Banner
          status="error"
          title={m.profile_save_error_title()}
          description={m.profile_save_error_description()}
        />
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          label={
            isPending ? m.profile_save_pending() : m.common_save_changes()
          }
          type="submit"
          variant="primary"
          isLoading={isPending}
          isDisabled={!isDirty || isPending}
          tooltip={!isDirty && !isPending ? m.profile_save_no_changes() : undefined}
        />

        {/* Text and an icon, not colour alone. */}
        {hasSaved && !isDirty && !isPending ? (
          <p className="text-success flex items-center gap-1.5 text-sm" role="status">
            <CheckIcon className="size-4" aria-hidden />
            {m.profile_save_success()}
          </p>
        ) : null}
      </div>
    </form>
  )
}
