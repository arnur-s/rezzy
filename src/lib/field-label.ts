import { m } from '@/paraglide/messages'

/**
 * Localized "Required" / "Optional" markers for a field label.
 *
 * Astryx's `isRequired` / `isOptional` props render those two words as English
 * literals hardcoded inside `FieldLabel`, bypassing the design system's own
 * translator. Astryx also ships no Russian catalogue, so on the primary locale
 * a field read "Полное имя · Required".
 *
 * Appending the marker to the `label` string keeps it in the same place, in the
 * same type ramp, and inside the element that names the input — so a screen
 * reader still hears it as part of the field's accessible name. Callers pair
 * this with `useNativeInputAttrs({ required: true })` to keep `aria-required`
 * on the input itself, which is the part `isRequired` was actually carrying.
 *
 * @example
 * <TextInput label={fieldLabel(m.profile_full_name_label(), 'required')} />
 */
export function fieldLabel(
  label: string,
  marker?: 'required' | 'optional',
): string {
  if (!marker) return label
  // The middot matches the separator Astryx draws between the two.
  const suffix = marker === 'required' ? m.field_required() : m.field_optional()
  return `${label} · ${suffix}`
}
