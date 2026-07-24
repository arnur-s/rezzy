/**
 * The readable column shared by the transcript, its loading skeleton, and the
 * composer, so all three align on one axis no matter how wide the pane gets.
 *
 * Deliberately a fixed max-width rather than Tailwind's `container`: that
 * tracks the breakpoint (up to 1536px) and lets messages sprawl across an
 * empty canvas on wide displays.
 */
export const TRANSCRIPT_MEASURE = 'mx-auto w-full max-w-[820px]'
