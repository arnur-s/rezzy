import { useCallback } from 'react'

/**
 * Input attributes Astryx's `TextInput` renders but does not type.
 *
 * `TextInputProps` extends `BaseProps`, which is built on
 * `React.HTMLAttributes` rather than `InputHTMLAttributes` and additionally
 * omits `inputMode`. So `autocomplete`, `inputmode`, and the `tel` input type
 * have no prop to travel through, even though `TextInput` spreads its rest
 * props onto the real `<input>` and forwards `ref` to it.
 *
 * Rather than cast around the prop type, set them on the element the ref
 * already hands us. `type` is deliberately included: `TextInputType` is
 * `'text' | 'password' | 'email'`, so `tel` — the one that gives phones a
 * numeric keypad on iOS and Android — is unreachable by prop.
 *
 * `required` is here for a different reason. Astryx's `isRequired` does two
 * things: it sets `aria-required` *and* it renders the literal English word
 * "Required" beside the label. That string is hardcoded in `FieldLabel`
 * rather than routed through Astryx's own translator, so on a Russian page —
 * and `ru` is `baseLocale` — it printed "Полное имя · Required". Setting the
 * ARIA state here lets the caller keep the semantics while writing the
 * visible marker in the app's own catalogue.
 */
export type NativeInputAttrs = {
  autoComplete?: string
  inputMode?: 'tel' | 'email' | 'numeric' | 'text'
  type?: 'tel'
  required?: boolean
}

/**
 * Returns a ref callback that applies `attrs` to the input once it mounts.
 *
 * Attributes are set rather than removed on unmount: the element is discarded
 * with the field, and React owns nothing else on it.
 */
export function useNativeInputAttrs(attrs: NativeInputAttrs) {
  const { autoComplete, inputMode, type, required } = attrs

  return useCallback(
    (element: HTMLInputElement | null) => {
      if (!element) return

      if (autoComplete) element.setAttribute('autocomplete', autoComplete)
      if (inputMode) element.setAttribute('inputmode', inputMode)
      // Assigning `type` on a mounted input is safe here because TextInput only
      // ever renders text-like types; switching to `tel` keeps the value.
      if (type) element.type = type
      // `aria-required` rather than the `required` attribute: the form is
      // validated by Zod, and the native attribute would let the browser
      // interrupt with its own, unlocalized bubble first.
      if (required) element.setAttribute('aria-required', 'true')
    },
    [autoComplete, inputMode, type, required],
  )
}
