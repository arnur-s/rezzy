import { AppPane } from '@/components/app-pane'
import { Tab, TabList } from '@astryxdesign/core/TabList'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

export type SettingsShellSection = {
  key: string
  /**
   * A fully resolved pathname, not a route template. The caller owns its own
   * params, so `$id` never reaches this file and the two settings areas can
   * share one selection rule instead of one each.
   */
  path: string
  label: string
}

type SettingsShellProps = {
  /** Rendered in the pane header. Pass the loading fallback, not a query. */
  title: string
  /** One line under the header saying what this area covers. */
  kicker: string
  navLabel: string
  sections: Array<SettingsShellSection>
  children: ReactNode
}

/**
 * Longest match wins.
 *
 * The account and workspace shells used to derive this two different ways — a
 * first-match `find` and a reversed loop — and neither generalizes. A parent
 * section whose path is a prefix of a child's (`…/settings` and
 * `…/settings/channels`) matches both, so the order sections happen to be
 * listed in decided which tab lit up. Length is the property that actually
 * distinguishes them.
 */
function selectSection(
  sections: Array<SettingsShellSection>,
  pathname: string,
): SettingsShellSection | undefined {
  let selected: SettingsShellSection | undefined
  let matched = -1

  for (const section of sections) {
    const base = section.path.replace(/\/$/, '')
    const isMatch = pathname === base || pathname.startsWith(`${base}/`)
    if (isMatch && base.length > matched) {
      matched = base.length
      selected = section
    }
  }

  return selected ?? sections[0]
}

/**
 * The frame both settings areas run inside: one pane, a header, a kicker, a
 * horizontal section nav, and the scrolling column the sections render into.
 *
 * It exists because the two were separately maintained copies of the same 50
 * lines, and the copies had already drifted — only one of them scrolled a
 * revealed tab back into view, and a class string mangled in one was fixed in
 * the other. There is now one place to get this right.
 */
export function SettingsShell({
  title,
  kicker,
  navLabel,
  sections,
  children,
}: SettingsShellProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const selected = selectSection(sections, pathname)
  const selectedKey = selected?.key ?? ''

  const tabScrollRef = useRef<HTMLDivElement>(null)

  // The row scrolls, so a section whose tab sits past the right edge would
  // otherwise open with its own tab off-screen — on a phone that is every deep
  // link to the last section, arriving on a strip that shows the other sections
  // and no sign of which one you are looking at. `nearest` leaves an
  // already-visible tab alone, and the jump is instant because this is the page
  // arriving rather than the user moving.
  //
  // `aria-current="page"` is how Astryx marks the selected tab. It renders a
  // `nav` of buttons rather than a `tablist`, so there is no `aria-selected` to
  // read; of the two attributes it does set, this is the standards-defined one,
  // where `data-selected="selected"` is its own internal spelling.
  useEffect(() => {
    const row = tabScrollRef.current
    if (!row) return

    let cancelled = false
    const reveal = () => {
      if (cancelled) return
      const selectedTab = row.querySelector('[aria-current="page"]')
      if (selectedTab instanceof HTMLElement) {
        selectedTab.scrollIntoView({
          behavior: 'instant',
          block: 'nearest',
          inline: 'nearest',
        })
      }
    }

    reveal()
    // Golos Text swaps in after this effect first runs, and the Cyrillic labels
    // widen when it does — measured 17px on "Безопасность" at 390px. The first
    // pass therefore scrolls against fallback-font widths and lands short,
    // leaving the end of the label clipped. `fonts.ready` has already resolved
    // on every later navigation, so this costs nothing after the first paint.
    void document.fonts.ready.then(reveal)

    return () => {
      cancelled = true
    }
  }, [selectedKey])

  return (
    // One pane on the canvas. The rule below the header is intra-pane, marking
    // the boundary between the fixed title and the region that scrolls under
    // it; the seam against the nav rail is the gutter, not a border.
    <AppPane>
      {/* 56px and a hairline — the shared pane-header contract, matching the
          conversation list, the thread, and the contact panel. The inset
          matches the column below it, so the title and the fields share one
          axis instead of the title floating 16px inside them. */}
      <header className="border-border/60 flex h-14 shrink-0 items-center border-b">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
          <h1 className="truncate text-base font-semibold">{title}</h1>
        </div>
      </header>

      {/* The pane owns the scroll edge-to-edge; the column inside it owns the
          measure, so the scrollbar rides the pane rather than the text.

          `px-4 sm:px-8` is the settings-column inset from DESIGN.md, and it is
          load-bearing rather than cosmetic: without it a phone renders every
          field flush against both screen edges, and the tab row's `-mx-4`
          bleed has nothing to bleed out of. The bottom half of `py-6 md:py-8`
          is what the last row scrolls to, so it does not end against the
          pane's own edge.

          The reserved scrollbar gutter is what keeps the sections from moving
          under each other. Profile is the only account section tall enough to
          scroll, so it was the only one with a scrollbar, and a classic 15px
          scrollbar narrows this box — which re-centers `mx-auto` and slid the
          whole column 7.5px left on Profile and back again on every other tab.
          The header sits outside this box and never moved, so the same 15px
          also pulled the title off the axis it shares with the fields.

          `both-edges` rather than plain `stable`: reserving on one side alone
          fixes the jump between sections but leaves the column permanently
          half a gutter off the header. Reserving on both keeps the box
          symmetric, so the two stay centered on the same axis.

          `md:` because that is where the column starts being centered at all —
          below 768px it is narrower than `max-w-3xl` and simply fills the
          pane, so there is nothing to re-center, and reserving 15px a side
          there would eat into the phone inset and the tab row's bleed. Where
          this row does overflow on a phone, the scrollbar is an overlay and
          reserves nothing anyway. */}
      <div className="min-h-0 flex-1 overflow-y-auto md:[scrollbar-gutter:stable_both-edges]">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 md:py-8">
          <p className="text-secondary text-xs font-medium">{kicker}</p>

          {/*
            One nav for both breakpoints. TabList lays its tabs out in a row but
            does not scroll them: at 390px the four Russian account labels need
            446px in a 358px column, so "Безопасность" was clipped off the
            screen with no way to reach it. The scroll container is ours.

            This has now been lost twice — most recently to a mangled class
            string (`-mx-4px-4`) that dropped the overflow and both insets in
            one token, which re-broke a shipped fix without failing anything.
            `settings-shell-mobile.test.ts` pins it.

            Without `overflow-x-auto` here the overflow lands on the pane's own
            `overflow-y-auto` above, which per CSS scrolls sideways too:
            reaching the last tab panned the entire settings page 71px, heading
            and form fields going with it.

            `overflow-y-hidden` is not redundant with it. CSS computes a
            `visible` axis to `auto` when its neighbour is not visible, so
            `overflow-x-auto` alone makes this row a scroll container in *both*
            directions and it picks up a vertical scrollbar of its own. Pinning
            the cross axis is what keeps the row one strip. `pb-1` is the room
            that leaves for a focused tab's ring, which Astryx offsets 2px and
            a hidden axis would otherwise clip.

            The scrollbar itself is hidden. Where this row actually overflows
            is a phone, and a touch scrollbar is an overlay that fades on its
            own; what a desktop window narrowed past `sm` gets instead is a
            permanent 15px slab of scrollbar between the tabs and the section
            under them. The affordance is the tab cut off at the edge, and
            keyboard users never needed the bar — Astryx moves focus along the
            strip with the arrow keys and the effect above scrolls the tab they
            land on into view.

            `-mx-4 px-4` lets the row bleed to the pane edges while the first
            tab keeps the page's own inset. The trailing inset is not
            recoverable: browsers leave a scroll container's end padding out of
            the scroll extent, so the last tab ends flush with the edge once
            the row is scrolled fully right. A trailing spacer does not restore
            it either — measured, not assumed.

            `scroll-px-*` matches the padding, so a tab revealed by keyboard
            movement or by the effect above keeps that inset wherever there is
            scroll room left to give it.

            The 44px floor applies only to coarse pointers: a thumb needs it, a
            mouse does not, and raising it everywhere would coarsen Astryx's own
            32px density on the desktop the app is mostly used on.
          */}
          <div
            ref={tabScrollRef}
            className="-mx-4 scroll-px-4 overflow-x-auto overflow-y-hidden px-4 pt-6 pb-1 [scrollbar-width:none] pointer-coarse:[&_button]:min-h-11 [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:scroll-px-8 sm:px-8"
          >
            <TabList
              value={selectedKey}
              onChange={(key) => {
                const target = sections.find((section) => section.key === key)
                if (target) void navigate({ to: target.path })
              }}
              aria-label={navLabel}
            >
              {sections.map((section) => (
                <Tab
                  key={section.key}
                  value={section.key}
                  label={section.label}
                />
              ))}
            </TabList>
          </div>

          <div className="pt-7">{children}</div>
        </div>
      </div>
    </AppPane>
  )
}
