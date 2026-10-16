# Optional brain layout

Implementation follows the revised plan from the private development repo (PR #1),
`docs/plan-amendments` at `295c29f59ec6fe04a5a82883d682dc7633858ef2`.
The merged `brain-v1` geometry is unchanged. See `CUSTOM.md` for every shared-file
hook and the existing CI scoping rules.

Build with `NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED=true` to expose the optional mode
in Memories. Missing, false or malformed values keep the existing network path.
Only the exact string `true` enables it. A container-start environment change
does not change an already-built client. Network remains the default; only a
user's explicit mode preference can restore Brain when enabled.

- `geometry.ts`, `layout.ts`, `types.ts`: original normalised hemispheres,
  rounded depth and deterministic version/ID/group positions. Work is bounded
  and independent of neighbours; geometry-wide bounds never shrink with filters.
- `adapter.ts`: deduplicate real IDs, cap at 500, preserve metadata, parallel
  types, loops and direction; omit unknown endpoints. Interleave link types,
  prioritising weight within each type for deterministic edge budgets.
- `canvas.tsx`, `controller.ts`, `scene.ts`: local Canvas lifecycle, controls,
  events, resize/fullscreen, scene preparation and SVG download. The scene preserves
  upstream heat colours and size semantics; local legends preserve their scales.
- `renderer.ts`, `render-model.ts`: renderer contract and drawing primitives. Canvas
  and SVG share transforms, paths, radii and safe hover text. SVG uses the live
  camera and current link selection.
- `integration.tsx`, `preference.ts`, `feature.ts`: lazy controls/provider,
  exact build flag, mode-only preference and positive API request budget.
- `messages/`, `brain.module.css`: isolated namespace for ten locales and scoped
  control styles. No global stylesheet, locale loader or token changes.

The static brain requests frames only on interaction/camera settling. The existing
mouse/wheel, fullscreen, hit testing and real-ID details callback are handled locally.
Brain hover text is drawn safely on Canvas
and escaped for SVG. Empty banks create no decorative nodes.

Tests are under `tests/custom/brain/`, including the moved geometry regressions.
Standard `npm test` and knip discover them without special entries. The hook test
recursively guards every source marker, paired brain-prefixed names, and exact
bidirectional coverage by the canonical `CUSTOM.md` hook register.

This step does not provide minimum pixel spacing, free rotation, touch/pinch
hardening, stale-response/bank-reset repairs or measured device FPS. Those belong
to later steps. The external access proxy and the CP access-key login are unchanged.
