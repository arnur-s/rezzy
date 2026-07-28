/**
 * Gothic Theme — ink and parchment
 *
 * Deep blue-gray tones and a distressed display heading, inspired by ink,
 * manuscript, and noir typography. Upstream gothic ships dark-only; this copy
 * adds the light half, so the app's Appearance setting has something to switch
 * to.
 *
 * Core palette: #E8F1F6, #96A0AB, #495056, #24292D, #101314
 *
 * Light mode inverts the same five tones rather than introducing new ones: the
 * parchment that writes the text in dark mode becomes the page, and the ink
 * that is the page becomes the text. Values are `[light, dark]` tuples, which
 * the build compiles to `light-dark()`.
 *
 * Categorical colors stay single-valued. They are dusty pastel chips carrying
 * deep same-hue text, which read the same against either page — the exception
 * is `gray`, which has to flip, because it is the neutral chip and the
 * secondary button and a dark slate would collide with the ink accent.
 *
 * Uses Manufacturing Consent for display sizes and Golos Text for body text.
 * Both are self-hosted in `src/fonts` and declared in `src/fonts/fonts.css`;
 * naming a family here does nothing on its own.
 */

import {defineSyntaxTheme, defineTheme} from '@astryxdesign/core/theme';
import {gothicIconRegistry} from './icons';

/**
 * Gothic syntax palette — atmospheric tones drawn from the gothic
 * categorical palette: deep purples (cathedral), blood crimson (tags),
 * aged gold (numbers), forest moss (strings), midnight indigo (functions).
 *
 * On parchment the same hues drop to their T30 step (see `gothicPalettes`),
 * which is where each one still reads as itself at 4.5:1 or better.
 */
const gothicSyntax = defineSyntaxTheme({
  name: 'xds-gothic',
  tokens: {
    keyword: ['#5a2370', '#c39adb'], // Cathedral plum
    string: ['#3a5e2c', '#a3c987'], // Forest moss
    comment: ['#5d646b', '#6b7079'], // Faded ink
    number: ['#876515', '#dec074'], // Aged gold
    function: ['#2a3b6e', '#8aa1d8'], // Midnight indigo
    type: ['#5a2370', '#c39adb'], // Cathedral plum
    variable: ['#101314', '#E8F1F6'], // Ink / parchment
    operator: ['#495056', '#96A0AB'], // Mid neutral
    constant: ['#6c5010', '#e6b85e'], // Candlelight amber
    tag: ['#8d2d4c', '#d97580'], // Blood crimson
    attribute: ['#876515', '#dec074'], // Aged gold
    property: ['#1f5e52', '#7cc5b3'], // Verdigris
    punctuation: ['#5d646b', '#7a8290'], // Mid neutral
    background: ['#FFFFFF', '#101314'],
  },
});

export const gothicTheme = defineTheme({
  name: 'gothic',

  typography: {
    // base 16 / ratio 1.25 — larger scale so the (optically small) blackletter
    // display sizes read large enough to carry the theme.
    scale: {base: 16, ratio: 1.25},
    // Golos Text rather than Fustat: `baseLocale` is `ru`, and Fustat ships
    // Arabic + Latin with no Cyrillic subset, so it would have left the default
    // locale in the system fallback while styling only Latin strings. Golos
    // Text carries both scripts.
    body: {
      family: 'Golos Text',
      fallbacks:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    // Headings (h1-h6) use Golos Text to match the body — Manufacturing Consent
    // is reserved for display sizes only (see component overrides below).
    heading: {
      family: 'Golos Text',
      fallbacks:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      weights: {3: 'bold', 4: 'bold'},
    },
    code: {
      family: 'JetBrains Mono',
      fallbacks: '"SF Mono", Monaco, Consolas, monospace',
    },
  },

  // Slower, theatrical motion — gothic doesn't rush.
  motion: {fast: 150, medium: 350, slow: 800, ratio: 0.75},

  syntax: gothicSyntax,

  tokens: {
    // =========================================================================
    // Colors — [light, dark]: parchment page / ink page
    // Core: #E8F1F6, #96A0AB, #495056, #24292D, #101314
    // =========================================================================

    // Core semantic
    '--color-accent': ['#101314', '#E8F1F6'],
    '--color-accent-muted': ['#10131420', '#E8F1F620'],
    '--color-neutral': ['#1013141A', '#E8F1F61A'],
    // Body and surface stay equal in both modes: panes separate by hairline and
    // by the raised card tone, never by a canvas/surface step. See DESIGN.md,
    // "The Rail Edge Rule".
    '--color-background-surface': ['#E8F1F6', '#101314'],
    '--color-background-body': ['#E8F1F6', '#101314'],
    // The scrim stays ink in both modes — a parchment scrim would bleach the
    // page instead of dropping it back. Lighter in light mode so the dialog
    // above it still wins.
    '--color-overlay': ['#10131466', '#101314CC'],
    '--color-overlay-hover': ['#1013140D', '#E8F1F60D'],
    '--color-overlay-pressed': ['#1013141A', '#E8F1F61A'],
    '--color-background-muted': ['#D8E2E9', '#24292D'],

    // Text
    '--color-text-primary': ['#101314', '#E8F1F6'],
    '--color-text-secondary': ['#495056', '#96A0AB'],
    '--color-text-disabled': ['#96A0AB', '#495056'],
    '--color-text-accent': ['#101314', '#E8F1F6'],
    // on-dark / on-light name the surface underneath, not the mode — they must
    // not flip.
    '--color-on-dark': '#E8F1F6',
    '--color-on-light': '#101314',
    '--color-on-accent': ['#E8F1F6', '#101314'],
    '--color-on-success': ['#E8F1F6', '#101314'],
    '--color-on-error': ['#E8F1F6', '#101314'],
    '--color-on-warning': ['#E8F1F6', '#101314'],

    // Icon
    '--color-icon-accent': ['#101314', '#E8F1F6'],
    '--color-icon-primary': ['#101314', '#E8F1F6'],
    '--color-icon-secondary': ['#495056', '#96A0AB'],
    '--color-icon-disabled': ['#96A0AB', '#495056'],

    // Surface variants — dark stacks tones upward from the page; light runs out
    // of room above parchment, so it raises with white plus shadow instead.
    '--color-background-card': ['#FFFFFF', '#1a1d20'],
    '--color-background-popover': ['#FFFFFF', '#24292D'],
    '--color-background-inverted': ['#101314', '#E8F1F6'],

    // Status / Sentiment — the dusty pastels are the dark voice. The app draws
    // these as text and as 5–15% tints of themselves (`bg-error/10 text-error`),
    // so the light value has to clear 4.5:1 against parchment *and* against its
    // own tint.
    //
    // Those two constraints pull opposite ways, and the first pass resolved the
    // conflict in the wrong direction twice:
    //
    //   Too dark. The tones were solved against a 20% tint, which no code
    //   draws — `bg-*/5`, `/10`, `/12`, and `/15` are the only alphas in `src`.
    //   Buying headroom for an alpha that does not exist cost about 1.5 tone
    //   steps and landed all three at 6.5–7.0:1 on a page that needs 4.5:1. On
    //   parchment that is not "readable", it is heavy: a validation message
    //   arrived at nearly the weight of the ink body text beside it, so an
    //   ordinary form error read as a system failure. These sit near 5.5:1
    //   instead — inside AA with margin, the 12% tint still at 4.6–4.7:1, and
    //   about a step and a half of weight handed back to the page.
    //
    //   Too gray. Once a tone is drawn at 10% alpha, chroma matters more than
    //   lightness, and the first pass left it low enough that the page won:
    //   `#8d2d4c` at 10% over parchment composites to C=0.011 h=298, against a
    //   page that is itself C=0.012 h=232. The error well came out a cool
    //   lavender-gray with no red in it, which is why an inline error strip read
    //   as a disabled row rather than as a problem. Raising chroma (0.087 →
    //   0.100 success, 0.132 → 0.150 error, 0.085 → 0.100 warning) keeps the
    //   hue alive through the composite while the lighter tone keeps it quiet.
    //
    // Hues are unchanged, so each tone still belongs to its family in
    // `gothicPalettes`. `scripts/theme-contrast.mjs` asserts every ratio named
    // here, the tint band included, so a future edit cannot quietly trade one
    // of these constraints away again.
    '--color-success': ['#406a30', '#b3c79a'], // forest moss / sage moss
    // Light error stays in the rose-madder family: the red ramp is a
    // desaturated rose, and its deep end reads as brown rather than as a
    // warning.
    '--color-error': ['#a83658', '#c6a6a2'], // blood crimson / dusty rose
    '--color-warning': ['#7c5a03', '#d3c490'], // deep gold / aged gold
    // `-muted` is only ever a fill (status message wells). Dark keeps the
    // opaque pastel; light steps up to about T90, where the same hue reads as a
    // soft note on parchment instead of a slab.
    //
    // The three light wells are now matched in lightness (L≈90.5%). They were
    // not: success sat at L=91.3% and warning at L=93.2%, but error at L=83.6%
    // — a full tone step heavier than its siblings. Weight is what a banner
    // signals with, so the same "here is a status" surface shouted in red and
    // whispered in gold, and the heavier red skewed brown as it darkened. One
    // lightness across all three puts the meaning in the hue and none of it in
    // the weight, which is the rule the dark half already keeps.
    '--color-success-muted': ['#d4e6ce', '#b3c79a'],
    '--color-error-muted': ['#f7d6dc', '#c6a6a2'],
    '--color-warning-muted': ['#ecdec4', '#d3c490'],

    // Border
    '--color-border': ['#1013141A', '#E8F1F61A'],
    '--color-border-emphasized': ['#96A0AB', '#495056'],

    // Effects
    '--color-skeleton': ['#bbc3cb', '#495056'],
    '--color-shadow': ['#1013141F', '#0000004D'],
    '--color-tint-hover': ['black', 'white'],

    // =========================================================================
    // Categorical — dusty pastel chips, the same in both modes
    // Hand-tuned dusty pastels (T75 with reduced chroma) — confident
    // but never bright. Each chip carries its own deep same-hue text, so it is
    // self-contained and needs no light/dark pair. Gray is the exception below.
    // =========================================================================

    // Blue (periwinkle midnight)
    '--color-background-blue': '#a3b5d6',
    '--color-border-blue': '#8696b8',
    '--color-icon-blue': '#2a3b6e',
    '--color-text-blue': '#1f2c54',

    // Cyan (cathedral mist)
    '--color-background-cyan': '#a3c2cf',
    '--color-border-cyan': '#86a4b1',
    '--color-icon-cyan': '#2a5e75',
    '--color-text-cyan': '#204858',

    // Gray (the "no-color" variant: a slate block with page-colored text, so it
    // is the one categorical that flips. On parchment a dark slate would read
    // as the ink accent, collapsing primary and secondary buttons together.)
    '--color-background-gray': ['#d5dee4', '#3d4248'],
    '--color-border-gray': ['#a8b1bb', '#5d646b'],
    '--color-icon-gray': ['#24292D', '#E8F1F6'],
    '--color-text-gray': ['#24292D', '#E8F1F6'],

    // Green (sage moss)
    '--color-background-green': '#b3c79a',
    '--color-border-green': '#96a880',
    '--color-icon-green': '#3a5e2c',
    '--color-text-green': '#244023',

    // Orange (warm tan)
    '--color-background-orange': '#d3b89a',
    '--color-border-orange': '#b6987d',
    '--color-icon-orange': '#8a4818',
    '--color-text-orange': '#6e3812',

    // Pink (dusty rose)
    '--color-background-pink': '#c89aab',
    '--color-border-pink': '#aa7d8e',
    '--color-icon-pink': '#8d2d4c',
    // Text is the T15 step for the same reason yellow's is, and the defect is
    // the same one: the pink ramp is not monotonic. Its T20 (`#71223c`, L=38.3%)
    // is *lighter* than its T25 (`#572235`, L=33.5%), so the step every other
    // chip reads as "deep same-hue text" is, on this one hue, a mid tone. Pink
    // also carries the second-darkest plate in the set (L=73.4%, against
    // 77–82% for its siblings), and the two together put the label at 4.34:1 —
    // under AA on a 10px `Badge`. T15 lands it at 6.71:1, inside the 5.2–6.7
    // band the other nine chips already occupy. The ramp itself is corrected
    // below, so the two agree.
    '--color-text-pink': '#3a131e',

    // Purple (muted plum)
    '--color-background-purple': '#b29bc4',
    '--color-border-purple': '#947da6',
    '--color-icon-purple': '#5a2370',
    '--color-text-purple': '#481b58',

    // Red (dusty rose)
    '--color-background-red': '#c6a6a2',
    '--color-border-red': '#a48581',
    '--color-icon-red': '#5e3a35',
    '--color-text-red': '#4a2520',

    // Teal (sage verdigris)
    '--color-background-teal': '#a3c2b6',
    '--color-border-teal': '#86a499',
    '--color-icon-teal': '#1f5e52',
    '--color-text-teal': '#174a40',

    // Yellow (aged gold)
    // Text is the T15 step, not the T20 every other chip uses. The yellow ramp
    // duplicates `#6c5010` at T20 and T25, so its "T20" sits a full step
    // brighter than its siblings and the label landed at 4.32:1 on the chip in
    // both modes. T15 puts it at 6.70:1, inside the 6.3-6.6 band the other
    // chips already occupy.
    '--color-background-yellow': '#d3c490',
    '--color-border-yellow': '#b6a775',
    '--color-icon-yellow': '#876515',
    '--color-text-yellow': '#4a3500',

    // =========================================================================
    // Radius — subtle rounding (original gothic)
    // =========================================================================
    '--radius-none': '0.125rem',
    '--radius-inner': '0.25rem',
    '--radius-element': '0.5rem',
    '--radius-container': '0.75rem',
    '--radius-page': '1.5rem',
    '--radius-full': '9999px',

    // =========================================================================
    // Shadows — restrained, atmospheric
    //
    // Only the color slot switches per mode; the geometry is shared. `light-dark()`
    // takes colors, not whole shadow lists, so these cannot be [light, dark]
    // tuples — a tuple would compile to `light-dark(0 2px 4px …, …)`, which is
    // not a valid box-shadow. Light mode tints with ink at low alpha rather
    // than black: pure black on parchment reads as dirt.
    // =========================================================================
    '--shadow-low':
      '0 2px 4px light-dark(#10131414, #00000033), 0 4px 8px light-dark(#1013141a, #00000040)',
    '--shadow-med':
      '0 2px 4px light-dark(#10131414, #00000033), 0 4px 12px light-dark(#1013141a, #00000040)',
    '--shadow-high':
      '0 4px 6px light-dark(#1013141a, #00000040), 0 12px 24px light-dark(#10131426, #0000004D)',
    '--shadow-inset-hover':
      'inset 0px 0px 0px 1px light-dark(#49505630, #96A0AB30)',
    '--shadow-inset-selected':
      'inset 0px 0px 0px 2px light-dark(#49505650, #96A0AB50)',
    '--shadow-inset-success':
      'inset 0px 0px 0px 1px light-dark(#3a5e2c50, #87b06a50)',
    '--shadow-inset-warning':
      'inset 0px 0px 0px 1px light-dark(#87651550, #d6b56a50)',
    '--shadow-inset-error':
      'inset 0px 0px 0px 1px light-dark(#8d2d4c50, #d4485150)',

    // =========================================================================
    // Semantic type scale — the Two-Size Rule, applied to Astryx as well
    //
    // `typography.scale` generates every `--text-*` token off `--font-size-base`
    // (16px here, chosen so the blackletter display sizes read large enough).
    // That put `--text-label-size` at 16px, so every Astryx field label, and
    // every Button label, rendered at the same size as a page `<h1>` and one
    // step *above* the 13px body text beside it. The page title had no lead
    // over a field label, and the only differentiated text on a form was its
    // helper copy — the least important thing on screen.
    //
    // One step down puts Astryx labels on the same 13px as `text-sm` and gives
    // 16px back to page titles alone.
    //
    // Two tokens deliberately keep their generated values:
    //
    //   --text-body-size (16px) sizes the value inside a field, and Safari on
    //   iOS force-zooms the viewport when a focused input is under 16px. Label
    //   and value are *meant* to differ here — the data is the loud part, its
    //   name is the quiet part.
    //
    //   --text-supporting-size (13px) is field description copy. 10px is this
    //   system's tier for timestamps, chips, and kickers — fragments, not
    //   sentences — and a description dropped to it reads as fine print. It
    //   separates from the 13px label by weight (400 vs 500) and by
    //   `--color-text-secondary`, which is how this system is documented to
    //   escalate anyway.
    // =========================================================================
    '--text-label-size': 'var(--font-size-sm)',

    // =========================================================================
    // The 12px floor
    //
    // `typography.scale` is base 16 / ratio 1.25, which generates 10.24px at
    // `xs` and then 8.19 / 6.55 / 5.24px at `2xs`, `3xs`, and `4xs`. The
    // product runs its whole metadata tier — timestamps, previews, chip labels,
    // filter labels, the failed-send caption — on `xs`, so 10px was not an edge
    // case in this UI, it was the second most common size on screen (67 `text-xs`
    // call sites against 85 `text-sm`).
    //
    // 10px is below the floor for interface text. iOS Safari treats sub-16px
    // inputs as a zoom trigger, Android's accessibility guidance puts 12sp at
    // the bottom of the legible range, and Golos Text is a Cyrillic-first face
    // whose descenders and soft signs are the first things to go — which the
    // default locale reads on every screen.
    //
    // So the ramp is clamped rather than rescaled. Rescaling (raising `base`,
    // or flattening the ratio) would move every size in the system, including
    // the display sizes the blackletter face is tuned for. Clamping moves only
    // the steps that were below the floor and leaves `sm`, `base`, and
    // everything above untouched.
    //
    // The four sub-`sm` steps all resolve to 12px, so they are one step now.
    // That is the point: this is a floor, not a scale. `2xs`, `3xs`, and `4xs`
    // are Astryx capacity that no product surface reaches for by name, and any
    // component that does reach for one lands on the floor instead of below it.
    '--font-size-xs': '0.75rem',
    '--font-size-2xs': '0.75rem',
    '--font-size-3xs': '0.75rem',
    '--font-size-4xs': '0.75rem',
  },

  components: {
    button: {
      // Primary inherits default — a page-inverted pill via --color-accent /
      // --color-on-accent: cream on ink in dark, ink on parchment in light.
      // Secondary uses the "neutral" badge treatment, which flips with it.
      'variant:secondary': {
        backgroundColor: 'var(--color-background-gray)',
        color: 'var(--color-text-gray)',
        borderColor: 'transparent',
        borderWidth: '0',
      },
      'variant:ghost': {
        ':hover': {
          backgroundColor: 'var(--color-overlay-hover)',
        },
      },
      // Destructive fills with --color-error, so its label has to be the token
      // that names "text on an error fill" rather than the red chip's text:
      // the fill is a pale dusty rose in dark and a deep crimson in light, and
      // only --color-on-error inverts with it.
      'variant:destructive': {
        backgroundColor: 'var(--color-error)',
        color: 'var(--color-on-error)',
      },
    },

    badge: {
      base: {
        borderRadius: 'var(--radius-element)',
        fontWeight: 'var(--font-weight-medium)',
      },
      'variant:info': {
        backgroundColor: 'var(--color-background-blue)',
        color: 'var(--color-text-blue)',
      },
      'variant:neutral': {
        backgroundColor: 'var(--color-background-gray)',
        color: 'var(--color-text-gray)',
      },
      'variant:success': {
        backgroundColor: 'var(--color-background-green)',
        color: 'var(--color-text-green)',
      },
      'variant:warning': {
        backgroundColor: 'var(--color-background-yellow)',
        color: 'var(--color-text-yellow)',
      },
      'variant:error': {
        backgroundColor: 'var(--color-background-red)',
        color: 'var(--color-text-red)',
      },
    },

    // A banner is the one status surface that runs the full measure, and the
    // categorical plates are sized for a chip: `#b3c79a` is right at 60px and a
    // slab at 700px, where it outshouts the ink primary button beside it. So the
    // fill is the `-muted` well — light drops to T90, dark keeps the opaque
    // pastel it already reads as. The hue survives at full strength in the icon,
    // the text, and the action chip; only the field goes quiet.
    //
    // Every status also rebinds the neutral chip, because a secondary Button in
    // `endContent` would otherwise land as `#d5dee4` — a cool gray at the same
    // tone as the well it sits on, which is a shape without an affordance. The
    // vivid tone fills it instead, so the loudest note on the banner is the
    // thing you are meant to press.
    banner: {
      base: {
        borderRadius: 'var(--radius-element)',
      },
      // Info has no status token to draw a well from (`--color-accent-muted` is
      // ink at 12.5%, a neutral wash, and blue is info's hue here), so the pair
      // is declared locally at the same T90 / opaque-pastel steps as the other
      // three rather than promoted to a global token nothing else would use.
      'status:info': {
        // Matched to the other three wells in light (L≈90.5%, C≈0.035) so all
        // four banners carry the same weight and differ only in hue. It was
        // `#dde2f1`, which is the blue ramp's own T90 — a step lighter and
        // barely half the chroma of its siblings, so the info banner read as a
        // faint gray band next to a distinctly rose error one.
        '--color-banner-info-well': 'light-dark(#d5e0f4, #a3b5d6)',
        backgroundColor: 'var(--color-banner-info-well)',
        '--color-text-primary': 'var(--color-text-blue)',
        '--color-text-secondary': 'var(--color-text-blue)',
        '--color-accent': 'var(--color-text-blue)',
        '--color-background-gray': 'var(--color-text-blue)',
        '--color-text-gray': 'var(--color-banner-info-well)',
      },
      'status:success': {
        backgroundColor: 'var(--color-success-muted)',
        '--color-text-primary': 'var(--color-text-green)',
        '--color-text-secondary': 'var(--color-text-green)',
        '--color-success': 'var(--color-text-green)',
        '--color-background-gray': 'var(--color-text-green)',
        '--color-text-gray': 'var(--color-success-muted)',
      },
      'status:warning': {
        backgroundColor: 'var(--color-warning-muted)',
        '--color-text-primary': 'var(--color-text-yellow)',
        '--color-text-secondary': 'var(--color-text-yellow)',
        '--color-warning': 'var(--color-text-yellow)',
        '--color-background-gray': 'var(--color-text-yellow)',
        '--color-text-gray': 'var(--color-warning-muted)',
      },
      'status:error': {
        backgroundColor: 'var(--color-error-muted)',
        '--color-text-primary': 'var(--color-text-red)',
        '--color-text-secondary': 'var(--color-text-red)',
        '--color-error': 'var(--color-text-red)',
        '--color-background-gray': 'var(--color-text-red)',
        '--color-text-gray': 'var(--color-error-muted)',
      },
    },

    card: {
      base: {
        padding: 'var(--spacing-3)',
        borderRadius: 'var(--radius-container)',
      },
      // Categorical variants — flip --color-text-primary so child
      // XDSText labels stay readable against the dusty pastel bg.
      'variant:blue': {
        '--color-text-primary': 'var(--color-text-blue)',
        '--color-text-secondary': 'var(--color-text-blue)',
      },
      'variant:cyan': {
        '--color-text-primary': 'var(--color-text-cyan)',
        '--color-text-secondary': 'var(--color-text-cyan)',
      },
      'variant:gray': {
        '--color-text-primary': 'var(--color-text-gray)',
        '--color-text-secondary': 'var(--color-text-gray)',
      },
      'variant:green': {
        '--color-text-primary': 'var(--color-text-green)',
        '--color-text-secondary': 'var(--color-text-green)',
      },
      'variant:orange': {
        '--color-text-primary': 'var(--color-text-orange)',
        '--color-text-secondary': 'var(--color-text-orange)',
      },
      'variant:pink': {
        '--color-text-primary': 'var(--color-text-pink)',
        '--color-text-secondary': 'var(--color-text-pink)',
      },
      'variant:purple': {
        '--color-text-primary': 'var(--color-text-purple)',
        '--color-text-secondary': 'var(--color-text-purple)',
      },
      'variant:red': {
        '--color-text-primary': 'var(--color-text-red)',
        '--color-text-secondary': 'var(--color-text-red)',
      },
      'variant:teal': {
        '--color-text-primary': 'var(--color-text-teal)',
        '--color-text-secondary': 'var(--color-text-teal)',
      },
      'variant:yellow': {
        '--color-text-primary': 'var(--color-text-yellow)',
        '--color-text-secondary': 'var(--color-text-yellow)',
      },
    },

    section: {
      base: {
        padding: 'var(--spacing-3)',
      },
    },

    field: {
      base: {
        borderRadius: 'var(--radius-element)',
      },
    },

    // Display sizes use Manufacturing Consent — the signature gothic
    // display font, reserved for hero/marketing-scale text only.
    text: {
      'type:display-1': {
        fontFamily:
          '"Manufacturing Consent", "UnifrakturMaguntia", "Old English Text MT", serif',
      },
      'type:display-2': {
        fontFamily:
          '"Manufacturing Consent", "UnifrakturMaguntia", "Old English Text MT", serif',
      },
      'type:display-3': {
        fontFamily:
          '"Manufacturing Consent", "UnifrakturMaguntia", "Old English Text MT", serif',
      },
    },
  },

  icons: gothicIconRegistry,
});

/**
 * Raw tonal palettes — every color at every tone step (0–100 in 5s).
 * Use these for custom components or data visualization.
 *
 * Categorical hues (blue, green, etc.) follow gothic gem-tone hues.
 * Neutral mirrors the original gothic blue-gray palette (H≈210).
 */
export const gothicPalettes = {
  // Neutral — H=210 C=4 (cool blue-gray, original gothic)
  neutral: {
    hue: 210,
    chroma: 4,
    0: '#000000',
    5: '#0a0d0f',
    10: '#101314',
    15: '#181c1f',
    20: '#24292D',
    25: '#2c3236',
    30: '#363c40',
    35: '#40464b',
    40: '#495056',
    45: '#535a61',
    50: '#5d646b',
    55: '#676f76',
    60: '#727a82',
    65: '#7e8690',
    70: '#8a929c',
    75: '#96A0AB',
    80: '#a8b1bb',
    85: '#bbc3cb',
    90: '#cdd5db',
    95: '#E8F1F6',
    100: '#ffffff',
  },
  // Blue — H=255 C=20 (midnight indigo)
  blue: {
    hue: 255,
    chroma: 20,
    0: '#000000',
    5: '#050930',
    10: '#0c143f',
    15: '#161e4d',
    20: '#1f2c54',
    25: '#2a3565',
    30: '#2a3b6e',
    35: '#3a4783',
    40: '#475497',
    45: '#5462ab',
    50: '#6170bf',
    55: '#6a85cf',
    60: '#7793d6',
    65: '#8aa1d8',
    70: '#a3b5e0',
    75: '#b6c5e7',
    80: '#c4d1ec',
    85: '#d2dcef',
    90: '#dde2f1',
    95: '#e8ecf6',
    100: '#ffffff',
  },
  // Cyan — H=200 C=25 (cathedral mist)
  cyan: {
    hue: 200,
    chroma: 25,
    0: '#000000',
    5: '#001724',
    10: '#062436',
    15: '#0d3046',
    20: '#204858',
    25: '#1c4a66',
    30: '#2a5e75',
    35: '#3a6e85',
    40: '#487d94',
    45: '#598ea3',
    50: '#6a9eb1',
    55: '#7ab0c0',
    60: '#8cc3d8',
    65: '#a0cce0',
    70: '#b1d3e5',
    75: '#bcdaeb',
    80: '#c5dfee',
    85: '#cbe4f0',
    90: '#d6e6ee',
    95: '#e3eef3',
    100: '#ffffff',
  },
  // Green — H=140 C=18 (forest moss)
  green: {
    hue: 140,
    chroma: 18,
    0: '#000000',
    5: '#0c1a08',
    10: '#152511',
    15: '#1c321a',
    20: '#2c4a20',
    25: '#2c4d2a',
    30: '#3a5e2c',
    35: '#446a39',
    40: '#557c44',
    45: '#658d50',
    50: '#779e5d',
    55: '#87b06a',
    60: '#96bd76',
    65: '#a3c987',
    70: '#b5d397',
    75: '#bdd99e',
    80: '#c8e0ad',
    85: '#d4e6bd',
    90: '#dde6d4',
    95: '#eaf3df',
    100: '#ffffff',
  },
  // Orange — H=40 C=35 (rust copper)
  orange: {
    hue: 40,
    chroma: 35,
    0: '#000000',
    5: '#1f0d00',
    10: '#2c1606',
    15: '#3a200d',
    20: '#6e3812',
    25: '#5a371a',
    30: '#8a4818',
    35: '#9a5824',
    40: '#a05728',
    45: '#b66839',
    50: '#c87a4a',
    55: '#d6905a',
    60: '#dca275',
    65: '#e1b288',
    70: '#e8b894',
    75: '#ebbf9d',
    80: '#eecfb5',
    85: '#efddcd',
    90: '#f3e5d8',
    95: '#f9eee5',
    100: '#ffffff',
  },
  // Pink — H=345 C=22 (rose madder)
  pink: {
    hue: 345,
    chroma: 22,
    0: '#000000',
    5: '#22060e',
    10: '#2e0c16',
    15: '#3a131e',
    // T20 was `#71223c` (L=38.3%), which is lighter than T25 (L=33.5%) and
    // broke the one invariant a tonal ramp has. `#481a2a` restores the order
    // (L≈29.5%, between T15's 25.2% and T25's 33.5%) and keeps the hue.
    20: '#481a2a',
    25: '#572235',
    30: '#8d2d4c',
    35: '#9b3358',
    40: '#a04563',
    45: '#a04a6e',
    50: '#b15876',
    55: '#c26988',
    60: '#cf7593',
    65: '#d56891',
    70: '#dc82a4',
    75: '#e094b1',
    80: '#e7a5be',
    85: '#ebb6ca',
    90: '#eed6df',
    95: '#f5e3eb',
    100: '#ffffff',
  },
  // Purple — H=290 C=30 (cathedral plum)
  purple: {
    hue: 290,
    chroma: 30,
    0: '#000000',
    5: '#1e0c25',
    10: '#2a1334',
    15: '#371b43',
    20: '#481b58',
    25: '#502163',
    30: '#5a2370',
    35: '#6e3088',
    40: '#82409c',
    45: '#9352ad',
    50: '#a363bd',
    55: '#b06ec9',
    60: '#bb7cd1',
    65: '#c084d6',
    70: '#c692db',
    75: '#cd9be0',
    80: '#d2a3df',
    85: '#dab3e6',
    90: '#e6daee',
    95: '#f0e6f4',
    100: '#ffffff',
  },
  // Red — H=15 C=12 (dusty rose) — gothic uses a desaturated rose
  // family rather than vibrant crimson; #c6a6a2 sits near T80.
  red: {
    hue: 15,
    chroma: 12,
    0: '#000000',
    5: '#1c0d09',
    10: '#26140f',
    15: '#301b16',
    20: '#3a231d',
    25: '#452c25',
    30: '#50352d',
    35: '#5b3e36',
    40: '#66483e',
    45: '#725347',
    50: '#7d5e51',
    55: '#896a5b',
    60: '#957565',
    65: '#a18170',
    70: '#ad8d7b',
    75: '#b99a87',
    80: '#c6a6a2',
    85: '#d2b4af',
    90: '#dec2bc',
    95: '#ebd0ca',
    100: '#ffffff',
  },
  // Teal — H=170 C=20 (verdigris)
  teal: {
    hue: 170,
    chroma: 20,
    0: '#000000',
    5: '#001b14',
    10: '#062821',
    15: '#0d3530',
    20: '#174a40',
    25: '#194e44',
    30: '#1f5e52',
    35: '#2c6c5f',
    40: '#3a7b6c',
    45: '#498a7a',
    50: '#5aa091',
    55: '#5db5a3',
    60: '#6cbeab',
    65: '#7cc5b3',
    70: '#90d0c0',
    75: '#9fd4c5',
    80: '#b1ddcf',
    85: '#c0e1d6',
    90: '#d4e7e2',
    95: '#e1efe9',
    100: '#ffffff',
  },
  // Yellow — H=80 C=40 (aged gold)
  yellow: {
    hue: 80,
    chroma: 40,
    0: '#000000',
    5: '#2c1d00',
    10: '#3a2900',
    15: '#4a3500',
    20: '#6c5010',
    25: '#6c5010',
    30: '#876515',
    35: '#9c7b1f',
    40: '#b18e2f',
    45: '#c39e3e',
    50: '#cca74c',
    55: '#d6b56a',
    60: '#dec074',
    65: '#e2c884',
    70: '#e6d091',
    75: '#e9d29a',
    80: '#ebd9a7',
    85: '#ebe1c4',
    90: '#f0e8d6',
    95: '#f7f1e3',
    100: '#ffffff',
  },
} as const;
