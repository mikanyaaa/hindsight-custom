# Customized Hindsight

This is a **public customized copy** of [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight) (MIT License) with a customized Hindsight UI/control plane for a self-hosted instance. Upstream code, history and attribution are preserved unchanged; see [LICENSE](LICENSE). Development originally happened in a private mirror, so PR numbers mentioned in these docs refer to that private development repo.

## Where the UI lives

- `hindsight-control-plane/`: Next.js (App Router) + React + Tailwind + Radix/shadcn, TypeScript.
  - Pages: `src/app/[locale]/...` (i18n via `src/i18n`, `src/messages`). Add custom views as new route folders here.
  - Server-side API proxy routes: `src/app/api/...`; they call the Hindsight API (dataplane) via `src/lib/hindsight-client.ts`.
  - Env: `HINDSIGHT_CP_DATAPLANE_API_URL` (default `http://localhost:8888`), `HINDSIGHT_CP_DATAPLANE_API_KEY`, `HINDSIGHT_CP_ACCESS_KEY` (UI login), `NEXT_PUBLIC_BASE_PATH`.
  - Dev: `npm install` at repo root, then `npm run dev -w @vectorize-io/hindsight-control-plane` (port 9999).
- Docker: `docker/standalone/Dockerfile` (stages `cp-builder`, `cp-only`; Next.js standalone output). Compose files in `docker/docker-compose/`.

## Runtime model compatibility

Provider and model selection stays in the process environment. An explicit
embedding provider, embedding model, reranker provider, or reranker model is
used as given and is not replaced by a built-in default. Built-in defaults apply
only when the corresponding variable is unset. The Docker image may cache the
unset local defaults at build time; that cache does not override the environment
at runtime. Do not switch an already configured embedding or reranker model to
one of those defaults.

The vector width default remains 384. v1.3.0 adds Alembic revisions after
`c7e2f9a4d1b8`. They add `banks.kind` (existing rows stay `memory`), the
knowledge-bank tables, a graph-maintenance claim timestamp, an attachment
discovery routine, and Oracle foreign-key indexes. Startup applies them. A
knowledge-bank embedding column is pinned to the configured knowledge embedder
on first use; if passages already exist at a different width, startup refuses
rather than rewriting them. Do not switch an already configured memory embedding
or reranker model to a built-in default: a dimension mismatch can still alter
the memory vector column at startup.

UI login remains the control-plane access key (`HINDSIGHT_CP_ACCESS_KEY`).
Authenticated MCP keeps the existing order: `HINDSIGHT_API_MCP_AUTH_TOKEN` when
set, otherwise the configured tenant extension's `authenticate_mcp`. This tree
does not replace that extension.

The control-plane image inlines its opt-in UI at `next build`. Pass these as
Docker build args (any value other than `true` leaves the feature off):

- `NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED` — brain memory layout
- `NEXT_PUBLIC_BASE_PATH` — reverse-proxy base path

Quiet Paper / Night Desk is the control-plane theme. It is part of the
stylesheet, not a build flag.

## Syncing with upstream

```bash
git remote add upstream https://github.com/vectorize-io/hindsight.git   # once
git fetch upstream
git checkout -b sync/upstream-$(date +%Y%m%d) origin/main
git merge upstream/main          # resolve conflicts, never force-push main
git push origin HEAD             # then open a PR into main
```

## Workflow

All changes go through pull requests against `main` (ChatGPT/Codex, Grok Bot, Cursor cloud agents, or by hand). Do not push directly to `main` and never force-push. Keep custom code isolated (e.g. new routes/components) to minimize merge conflicts with upstream.

## Shared-file change register (CUSTOM-HOOK)

Edits to upstream-owned files are marked in-place with a `CUSTOM-HOOK <id>` comment so they are easy to find (`rg CUSTOM-HOOK`) and re-apply after an upstream sync.

### `ci-fork-scope` - run only secret-free CI in the mirror

The mirror has no Actions secrets, so jobs that need LLM/embedding/cloud credentials can never pass here. They are guarded with `github.repository == 'vectorize-io/hindsight'` (i.e. they still run upstream). To re-enable a job in the mirror, add the secrets and drop the guard.

| File | Job / step | Change |
|---|---|---|
| `.github/workflows/test.yml` | `detect-changes` output `has_secrets` | now also requires `github.repository == 'vectorize-io/hindsight'`. This single hook skips every job gated on `has_secrets`: `test-rust-cli`, `test-api` (3 shards), `test-api-llm-core`, `test-api-llm-acceptance`, `test-api-oracle`, `test-python-client`, `test-typescript-client`, `test-python-client-oracle`, `test-typescript-client-oracle`, `test-typescript-client-deno`, `test-rust-client`, `test-go-client`, `test-openclaw-integration`, `test-integration`, `test-pip-slim`, `test-embed`, `test-embed-windows`, `test-hindsight-all`, `test-doc-examples`, `test-upgrade` |
| `.github/workflows/test.yml` | `build-docker-images` smoke steps | credential setup stays upstream-only. The matrix is now the control-plane image alone (see `ci-minutes`). That container probe is `/api/health`, which stays HTTP 200 with no `HINDSIGHT_CP_ACCESS_KEY`, so it still smokes without credentials |
| `.github/workflows/perf-test.yml` | `perf-test`, `amb`, `obs`, `system-evals` | `if: github.repository == 'vectorize-io/hindsight'` |
| `.github/workflows/security-scan.yml` | `scan-published`, `scan-next-build` | `if: github.repository == 'vectorize-io/hindsight'` |
| `.github/workflows/windows-smoke.yml` | `windows-client-smoke` | `if: github.repository == 'vectorize-io/hindsight'` |
| `.github/workflows/release.yml` | every job | `workflow_dispatch` only, and `if: github.repository == 'vectorize-io/hindsight'` |
| `.github/workflows/release-integration.yml` | `publish` | same guard |
| `.github/workflows/sign-images.yml` | `sign` | same guard |
| `.github/workflows/deploy-docs.yml` | `build`, `deploy` | `workflow_dispatch` only, same guard, `cancel-in-progress: true` |
| `.github/workflows/triage-labels.yml` | `label` | `workflow_dispatch` only, same guard |

### `ci-minutes` - keep one path-scoped check
Actions minutes are spent by CI, not by the scheduled workflows (those jobs already skipped). A UI pull request was building five Docker images plus the docs site and the generator diff.

| File | Change |
|---|---|
| `.github/workflows/test.yml` | Draft PRs skip `detect-changes` (no runners). `ready_for_review` runs CI. No `push` trigger, so a branch push does not double a pull request. `concurrency` already cancels in progress. Root `*.md` is `paths-ignore`. |
| `.github/workflows/test.yml` | `ci` path filter matches nothing, so a workflow-only edit does not fan out into every package job. |
| `.github/workflows/test.yml` | `build-docs` runs for `hindsight-docs/**` only. `verify-generated-files` runs for generator inputs only. |
| `.github/workflows/test.yml` | `build-docker-images` is the control-plane image only, and only when `docker/**` changes. Its smoke still probes public `/api/health` and does not set an access key. |
| `.github/workflows/test.yml` | `build-control-plane` smoke sets throwaway `HINDSIGHT_CP_ACCESS_KEY=ci-smoke-dummy` and checks that `/` redirects to `/login` and `/login` returns 200. It does not set `HINDSIGHT_CP_ALLOW_UNAUTHENTICATED`. |
| `.github/workflows/test.yml` | `build-api-python-versions` is Python 3.11 only. `build-rust-cli-arm64` is upstream-only. |
| `.github/workflows/perf-test.yml`, `security-scan.yml`, `windows-smoke.yml` | Schedules removed. `workflow_dispatch` remains. Security and Windows cancel in progress. |

Still the meaningful pull-request checks: `build-control-plane` when the UI or the TypeScript client changes, `test-system` plus `typecheck-api` when the API changes, and the matching package job when that package changes. Secret-gated jobs stay skipped.

### Sidebar accessibility (PR B)

These accessibility fixes apply independently of any theme flag. Native modified
links keep their browser behavior. Upstream v1.2 draws the same nav in a desktop
rail and a phone drawer, and the keyboard toggle is the explicit button. The
aside stays a mouse target and does not carry a button role.

| File                         | Marker names               | Purpose                                                                 |
| ---------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `src/components/sidebar.tsx` | `sidebar-link-state`       | Accessible names for icon links and current-page state.                 |
| `src/components/sidebar.tsx` | `sidebar-native-modifiers` | Preserve Shift/Alt link behavior alongside upstream Ctrl/Meta handling. |

The recursive registry validates paired unique `brain-` and `sidebar-` hooks.

### Optional brain layout (step 2)

Source: PR #1, `docs/plan-amendments` at `295c29f59ec6fe04a5a82883d682dc7633858ef2`,
`docs/plans/ai-brain-network-v2.md` and `docs/plans/AMENDMENTS-2026-10-15.md`.
Implementation, styles and translations live in `hindsight-control-plane/src/custom/brain/`.
Tests live in `hindsight-control-plane/tests/custom/brain/` with standard Vitest discovery.
The earlier special discovery entry in `vitest.config.ts` is removed because the geometry
tests moved there. No knip exemption or CI-scoping change is needed.

Enable only with `NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED=true` **at build time**.
Every other value means off. Network remains the default. Only an opted-in mode
preference stores `network` or `brain`; flag off never reads that preference.
Flag off selects the existing component directly, ignores a supplied custom renderer,
preserves request limits and does not load the lazy controls/styles/messages.

The table below is the **source of truth** for all brain source hooks; the plan
links here instead of maintaining a second directory. Every Brain marker in `src/` must
use a unique `brain-` name with paired begin/end comments, and every registered
name must exist in the listed source file. The recursive hook-registry test
rejects unregistered, malformed, unpaired and orphaned entries.

The shared constellation has three `brain-` hook pairs. It dispatches to
`brainRenderer.render` only behind the exact flag. Separate `graph-frame-` hooks
in the same file keep the network drawing path but stop it rasterizing every
display frame. The custom renderer owns scene preparation,
Canvas lifecycle, mouse/wheel events, resize/fullscreen, safe hover labels,
SVG download and toolbar. It reuses the existing custom drawing primitives,
without copying the upstream renderer or adding new interaction capabilities.

| File                               | Marker names                                                    | Purpose                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/components/constellation.tsx` | `brain-network-imports`                                         | Type-only renderer contract and the small exact-flag helper.                                                       |
| `src/components/constellation.tsx` | `brain-network-contract`                                        | Optional renderer object; existing callers keep their defaults.                                                    |
| `src/components/constellation.tsx` | `brain-network-dispatch`                                        | Flag-gated renderer-object entry; otherwise mount the unchanged network component. Euler views also stay upstream. |
| `src/components/data-view.tsx`     | `brain-network-entry`                                           | Flag-gated lazy memory renderer and small mode/limit helpers.                                                      |
| `src/components/data-view.tsx`     | `brain-network-mode`                                            | Custom mode state; storage effects are inert when disabled.                                                        |
| `src/components/data-view.tsx`     | `brain-network-active`                                          | Apply the brain budget only while its graph is visible; table/timeline retain normal limits.                       |
| `src/components/data-view.tsx`     | `brain-network-request-limit`                                   | Positive limit capped at 500 only in brain mode; preserve bank/filter fields.                                      |
| `src/components/data-view.tsx`     | `brain-network-request-signature`, `brain-network-request-deps` | Reload on layout budget changes; normal signature stays identical.                                                 |
| `src/components/data-view.tsx`     | `brain-network-view`                                            | Replace this call site only; pass custom mode controls.                                                            |

This step adds no hooks in `src/messages/*.json`, `src/i18n/request.ts`, HomeView, Entities, auth or CSP.
`integration.tsx` contains the local controls/provider and `legend.tsx` the responsive data legend.
Multi-group Euler views (`nodeGroupsFn`) fall back to upstream and hide the layout toggle.
The local brain provider merges inherited messages and adds only its own namespace in
all ten supported locales. Data colours and legends take priority over decoration.
At most 500 real nodes / 5,000 links are drawn; loaded versus shown counts are explicit.
Metadata/direction survive adaptation, including parallel types and loops; unknown endpoints
are omitted. No minimum point spacing is promised.

Step 3 still owns full touch/pinch controls, stale-response/bank-reset hardening and device
performance acceptance. This step adds no ambient animation, including under reduced-motion.
No deployment, global theme, HomeView or personality/projects view.

## Graph frame budget

The network constellation and the brain canvas both redraw vectors on the main
thread. Ambient drift at overview zoom is sub-pixel, and a pan or zoom was
restroking every curve while the camera eased. Sampling waits until the drift
is visible (about half a pixel, immediately when zoomed in). A sample that
took longer than a frame waits four times that long, at most one second. A
gesture reuses the last crisp frame and draws vectors again when the camera
settles. The backing store is capped at 1.5× and 1.6 million pixels.
`prefers-reduced-motion` starts the network paused unless the motion toggle was explicitly turned on,
and snaps the brain camera instead of easing it. No new environment variable.

`src/custom/graph/dataset.ts` builds synthetic graphs for tests (3_000 nodes at
degree 12 is 18_000 links). It is not wired to a bank.

| File | Marker names | Purpose |
| --- | --- | --- |
| `src/components/constellation.tsx` | `graph-frame-import` | Frame-budget helpers. |
| `src/components/constellation.tsx` | `graph-frame-motion` | Honour reduced motion unless the toggle was set. |
| `src/components/constellation.tsx` | `graph-frame-snapshot` | Blit the settled frame while the camera eases. |
| `src/components/constellation.tsx` | `graph-frame-sample` | Sample ambient drift instead of drawing every frame. |
| `src/components/constellation.tsx` | `graph-frame-dpr` | Cap the backing store. The fullscreen remeasure uses the same helper. |
| `src/components/constellation.tsx` | `graph-frame-draw` | Cancel a pending sample when input asks for a frame. |

## Quiet Paper / Night Desk

The theme is always on. Tokens, the grain tile and the blocking theme script live in
`hindsight-control-plane/src/custom/theme/`. There is one accent (`#5B47D6` /
`#A699FF`), three radii (6 / 10 / 14) and a type scale from 12px to 32px. Glass blur
is limited to dialogs, menus and popovers. `main` and `aside` stay sharp. The
`.dark` class comes from the `hs-theme` cookie during server render and from a
parser-blocking inline script, so the first paint is not the old blue palette.
The bank frame is a 232px rail (collapse saved on the `hs-sidebar` cookie), a
command menu in the top bar, and a solid bottom tab bar on phones.
Buttons, fields, cards, menus and badges take their size from that scale:
6px for badges and menu items, 10px for controls, 14px for panels, type from
12px, and a 44px control height. The memory graph uses the same surfaces,
accent and chart colours. Its canvas reads them from
`src/custom/theme/graph-palette.ts`. The home page is a 48px recall field,
four counts, the last seven days of memories grouped by tag, and mental
models with their freshness beside a short memory map. A point on that map
opens the memory. Asking from home opens recall with the question filled in.
List pages share one loading panel, one empty panel and one error panel in
`src/custom/pages/`. A failed load stays quiet while the session dialog or the
timeout banner is showing, so an expired session reads as Sitzung abgelaufen
and not as a second network error. Filter controls and icon buttons on those
pages are 44px, and the remaining 10px and 11px type is 12px.

With Playwright available, run `node tests/custom/theme/layering-browser.cjs` from
`hindsight-control-plane/` for light/dark checks at 390, 768 and 1440px.
`node tests/custom/pages/visual.cjs` opens every page at 390 and 1440, in light
and dark, against fictional data. It is a local script: vitest does not launch
it, and no GitHub Actions workflow runs it.

| File                          | Marker names                                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `src/app/globals.css`         | `theme-quiet-paper-entry`                           | Import the token stylesheet into the critical CSS.              |
| `src/app/[locale]/layout.tsx` | `theme-quiet-paper-fonts`, `theme-quiet-paper-boot`, `frame-quiet-paper-seed` | Geist, theme cookie, blocking script, sidebar cookie. |
| `src/lib/theme-context.tsx`   | `theme-quiet-paper-persist`                         | Keep the saved theme on the `hs-theme` cookie.                  |
| `src/lib/page-download.tsx`   | `theme-quiet-paper-print`                           | Print margin uses the same accent.                              |
| `src/components/sidebar.tsx`  | `frame-quiet-paper-rail`                            | 232px rail, saved collapse, phone drawer optional.              |
| `src/app/[locale]/banks/[bankId]/page.tsx` | `frame-quiet-paper-shell`              | Bottom tab bar and room for it under the page.                  |
| `src/components/bank-selector.tsx` | `frame-quiet-paper-bar`                       | Command menu and a 44px theme control in the top bar.           |
| `src/components/ui/button.tsx` | `primitive-quiet-paper-button`                    | 44px buttons, 10px radius, 14px type.                            |
| `src/components/ui/input.tsx` | `primitive-quiet-paper-input`                     | Fields match the button height and type.                        |
| `src/components/ui/textarea.tsx` | `primitive-quiet-paper-textarea`               | Same field chrome, room to write.                                |
| `src/components/ui/select.tsx` | `primitive-quiet-paper-select`                   | Select trigger, menu and items on the same scale.                |
| `src/components/ui/card.tsx` | `primitive-quiet-paper-card`                       | 14px panel, hairline border.                                     |
| `src/components/ui/table.tsx` | `primitive-quiet-paper-table`                     | 14px frame and 12px column labels.                               |
| `src/components/ui/facet-chip.tsx` | `primitive-quiet-paper-chip`                 | Chips use 12px and up.                                           |
| `src/components/staleness-badge.tsx` | `primitive-quiet-paper-badge`               | Freshness badge is 12px on a 6px radius.                         |
| `src/components/ui/dialog.tsx` | `primitive-quiet-paper-dialog`                   | Dialog panel is 14px, close control is 44px.                     |
| `src/components/ui/alert-dialog.tsx` | `primitive-quiet-paper-alert`               | Alert panel matches the dialog.                                  |
| `src/components/ui/dropdown-menu.tsx` | `primitive-quiet-paper-menu`              | Menu items are 44px on a 14px panel.                             |
| `src/components/ui/popover.tsx` | `primitive-quiet-paper-popover`                 | Popover uses the panel radius, no blue edge.                     |
| `src/components/ui/command.tsx` | `primitive-quiet-paper-command`                 | Command rows match the menu items.                               |
| `src/components/ui/checkbox.tsx` | `primitive-quiet-paper-check`                  | Unchecked box uses the ink, not the old blue.                    |
| `src/components/ui/inline-attachment-text.tsx` | `primitive-quiet-paper-attachment` | Attachment labels stay on the type scale.                 |
| `src/components/constellation.tsx` | `theme-quiet-paper-graph` | Memory graph chrome, links and type use the token palette. |
| `src/components/home-view.tsx` | `home-quiet-paper-desk` | Home is the recall field, the week, and the short map. |
| `src/components/search-debug-view.tsx` | `home-quiet-paper-recall` | A question from home runs on the recall page. |
| `src/components/bank-stats-view.tsx` | `theme-quiet-paper-graph-stats` | Link-type chart matches the graph. |

The recursive registry accepts registered `brain-`, `theme-`, `frame-` and `primitive-` namespaces, with
unique paired markers and exact file matching.

## Fail-closed auth, public health, and UI guards

Custom behavior stays behind these markers. The access key is required unless
`HINDSIGHT_CP_ALLOW_UNAUTHENTICATED=true`. Public paths match exactly or on a
path segment. Polling pauses while the tab is hidden. Relative times use the
app locale. Session expiry and request timeouts render in `src/custom/`.

| File | Marker names | Purpose |
| --- | --- | --- |
| `src/middleware.ts` | `cp-auth-fail-closed` | Refuse protected routes when the access key is unset. |
| `src/app/api/health/route.ts` | `public-health-cp` | Public liveness body; dataplane detail only for a session. |
| `src/lib/api.ts` | `client-guard-fetch` | Detect an expired upstream session and a 20s data-fetch timeout. |
| `src/app/[locale]/layout.tsx` | `client-guard-entry`, `client-guard-mount` | Mount the session and timeout states inside the locale provider. |
| `src/lib/relative-time.ts` | `relative-time-locale` | Locale-aware relative time; invalid input renders a dash. |
| `src/lib/use-refresh-attempts.ts` | `visible-poll-attempts` | Pause attempt polling while the tab is hidden. |
| `src/components/documents-view.tsx` | `visible-poll-documents`, `relative-time-documents` | Visible-tab document refresh and locale timestamps. |
| `src/components/pages-view.tsx` | `visible-poll-knowledge`, `relative-time-knowledge` | Visible-tab page refresh and locale timestamps. |
| `src/components/bank-operations-view.tsx` | `visible-poll-operations` | Visible-tab operations refresh. |
| `src/components/bank-profile-view.tsx` | `visible-poll-profile` | Visible-tab profile refresh. |
| `src/components/bank-stats-view.tsx` | `visible-poll-stats`, `visible-poll-timeseries`, `relative-time-stats` | Visible-tab stats refresh and locale timestamps. |
| `src/components/cron-schedule-preview.tsx` | `relative-time-cron` | Pass the app locale into relative time. |
| `src/components/freshness-line.tsx` | `relative-time-freshness` | Pass the app locale into relative time. |
| `src/custom/home/home-desk.tsx` | `relative-time-home` | Pass the app locale into relative time. |
| `src/components/next-refresh.tsx` | `relative-time-next` | Pass the app locale into relative time. |
| `src/components/banks-overview.tsx` | `relative-time-banks` | Pass the app locale into relative time. |
| `src/components/mental-models-view.tsx` | `relative-time-models` | Pass the app locale into relative time. |
| `src/components/mental-model-detail-modal.tsx` | `relative-time-model-detail` | Pass the app locale into relative time. |
| `src/components/bank-selector.tsx` | `relative-time-selector` | Pass the app locale into relative time. |

## Async MCP reflect

MCP `reflect` and `sync_retain` queue the work and wait up to `wait_seconds` (default 20, clamped to 0–25). A reflect that finishes in time returns the same body as before. One that is still running returns `status: pending` and an `operation_id` for `get_reflect_result`. `sync_retain` uses the existing retain operation; a pending result is polled with `get_operation`. Both tools run only after the same origin authentication as the other MCP tools, and the operation lookup stays on the bank that request authorized.

Reflect operations use `operation_type=reflect`. One worker slot is reserved for them (`HINDSIGHT_API_WORKER_REFLECT_RESERVED_SLOTS`, default 1) so consolidation and mental-model refresh cannot take every slot. No database migration.

`CUSTOM-HOOK async-mcp-reflect` marks the reservation default in `hindsight-api-slim/hindsight_api/config.py`. The behavior lives in `engine/memory_engine.py`, `engine/operation_metadata.py`, `mcp_tools.py`, and `api/mcp.py`.
