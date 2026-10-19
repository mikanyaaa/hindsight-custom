# Optional warm glass theme

## Goal

Keep the frosted glass dashboard, calm bright lo-fi city backdrop, pill navigation,
and modular home panels, while making customization removable and upstream-safe.
This replaces the rejected monolithic approach in PR #6. No merge or deployment;
The maintainer decides on merges. All three replacement PRs start independently from latest
`origin/main` (verified base: `33273eb`). No new dependencies.

## Scope and delivery

| PR | Scope | Shared files |
| --- | --- | --- |
| A: theme layer | Scoped tokens/chrome, local lazy backdrop, fallbacks, contrast tests, this plan and asset provenance | One root-layout hook; hook-registry namespace extension |
| B: sidebar accessibility | Current link state and native modifier-key handling; preserve click/keyboard chrome toggle | Minimal marked sidebar hooks; registry tests |
| C: home restyle | Modular home layout under `src/custom/`, using the upstream data/rendering path | Minimal home integration hook(s); registry tests |

PR C must work by itself with the same flag. When combined with A its panels inherit
A's palette. No stacked branches, unrelated personality documentation, committed
binary screenshots, shared UI-primitive edits, global CSS edits, unmarked page-wrapper
edits, graph renderer edits, API changes, or data-color changes.

## Flag and loading

Only `NEXT_PUBLIC_HINDSIGHT_THEME_WARM_GLASS=true` enables the customization, at
build time. Unset, false, invalid values and `TRUE` mean off. Rebuild to change it.
PR A's root hook lazy-loads a custom client layer; the layer imports CSS after
`globals.css`, then sets `data-theme-layer="warm-glass"` on the document root.
No wrapper DOM is introduced. Every selector is rooted under that attribute.
The wallpaper is separately imported after idle; a solid background works while
loading. Flag off returns upstream children and does not load theme CSS or artwork.
A short upstream-to-theme transition is an intentional cost of noncritical loading.

## Hook inventory

`CUSTOM.md` is authoritative for exact names and paths. PR A registers only
`theme-warm-glass-entry` in `src/app/layout.tsx`. PR B registers `sidebar-link-state` and `sidebar-native-modifiers` in
`src/components/sidebar.tsx`. PR C registers `home-warm-panels-entry` in
`src/app/[locale]/banks/[bankId]/page.tsx`. Each PR updates CUSTOM.md and the recursive paired-marker test for its
own namespace. Unregistered, duplicate, malformed and orphaned markers must fail.
Existing Brain hooks and behavior remain intact.

## Upstream sync

Use a topic branch, fetch upstream, and merge (prefer merge for published branches;
never force-push). Save the hook inventory and diff before syncing. Resolve shared
files from upstream and reapply only the registered hooks. Verify custom modules
against new types/markup. Compare the registry in both directions, then run the
complete off/on test/build matrix. Never alter main directly.

Conflict hotspots: root layout, sidebar link handlers, home entry, and the hook
registry test. CSS selectors also depend on upstream bank chrome structure, Tailwind
utility classes, and home panel hierarchy; inspect these even when Git reports no
textual conflict. No global CSS or shadcn primitive conflicts should be introduced.

## Asset governance

See [ASSET.md](../design/warm-glass/ASSET.md) for origin, generation tool, exact prompt,
date, content/IP statement and size. Local WebP only, lazy loaded, no external image
host. Keep the compressed asset below 250 KB; review future replacements. Screenshots
belong in PR attachments or a separate docs branch, not these code branches.

## Risks and boundaries

- Blur costs GPU bandwidth: limit it to header/sidebar chrome and one decorative main pseudo-element; no animated blur,
  canvas-frame style reads, or ambient animation. Reduced transparency and unsupported
  filters use opaque panels. Reduced motion disables custom transitions.
- Text on artwork: strong panel tint; automated WCAG contrast calculation over
  black/white image extremes for normal, muted and primary text. Manually inspect
  status colors, disabled controls and composited screenshots as well.
- Brain/Network: preserve canvas backgrounds, rendering algorithms, data colors,
  limits, fixed fullscreen stacking, export and interactions. No backdrop-filter or
  transformed ancestor on main/graph panels; test theme and Brain flags together.
- Lazy loading may visibly apply the theme after hydration. Do not claim flag-off
  bundle parity from unit tests alone: inspect production CSS/network requests.
- **No auth/CSP change.** The external access proxy and the control-plane access-key login
  remain untouched. No secrets, new dependencies, or deployment changes.

## Acceptance criteria

At 390, 768 and 1440 CSS pixels, in light and dark mode:

- No page-level horizontal overflow; navigation and bank selection remain usable.
- Text, focus indicators, dialogs, input labels and current-navigation state remain
  readable; keyboard links and sidebar click/Enter/Space toggle work.
- Home panels preserve real loading/empty/data states and actions; no synthetic stats.
- Network and opted-in Brain fullscreen, selection and export remain usable.
- Reduced motion/transparency and unsupported-blur fallbacks remain readable.
- Flag off: upstream DOM/behavior, no theme attribute/class, theme stylesheet or
  backdrop request. Flag on: scoped layer, visible city and glass; no console errors.

For every PR run and report the client build, frontend `npm test`, `tsc --noEmit`,
ESLint, production build with flag unset and with exact `true`, repository lint and
code review. Run targeted hook/contrast/component tests and browser checks. Record
actual commands/results and any limitations in a PR comment. Fixture-backed browser
checks do not validate live backend or access-provider authentication. Never report
unrun checks as passed.
