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

The vector width default remains 384. v1.2.0 does not add an Alembic revision
after `c7e2f9a4d1b8`, which is also the v1.1.0 head, so a database already at
that revision gets no further schema changes from this upgrade.

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
| `.github/workflows/test.yml` | `build-docker-images` smoke steps | credential setup stays upstream-only. The matrix is now the control-plane image alone (see `ci-minutes`), which smokes without credentials |
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
| `.github/workflows/test.yml` | `build-docker-images` is the control-plane image only, and only when `docker/**` changes. |
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

The shared constellation has only **three** hook pairs. It dispatches to
`brainRenderer.render` only behind the exact flag; the network component body is
otherwise identical to upstream. The custom renderer owns scene preparation,
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

No hooks in `src/messages/*.json`, `src/i18n/request.ts`, HomeView, Entities, auth or CSP.
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

## Quiet Paper / Night Desk

The theme is always on. Tokens, the grain tile and the blocking theme script live in
`hindsight-control-plane/src/custom/theme/`. There is one accent (`#5B47D6` /
`#A699FF`), three radii (6 / 10 / 14) and a type scale from 12px to 32px. Glass blur
is limited to dialogs, menus and popovers. `main` and `aside` stay sharp. The
`.dark` class comes from the `hs-theme` cookie during server render and from a
parser-blocking inline script, so the first paint is not the old blue palette.
The bank frame is a 232px rail (collapse saved on the `hs-sidebar` cookie), a
command menu in the top bar, and a solid bottom tab bar on phones.

With Playwright available, run `node tests/custom/theme/layering-browser.cjs` from
`hindsight-control-plane/` for light/dark checks at 390, 768 and 1440px.

| File                          | Marker names                                        | Purpose                                                         |
| ----------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `src/app/globals.css`         | `theme-quiet-paper-entry`                           | Import the token stylesheet into the critical CSS.              |
| `src/app/[locale]/layout.tsx` | `theme-quiet-paper-fonts`, `theme-quiet-paper-boot`, `frame-quiet-paper-seed` | Geist, theme cookie, blocking script, sidebar cookie. |
| `src/lib/theme-context.tsx`   | `theme-quiet-paper-persist`                         | Keep the saved theme on the `hs-theme` cookie.                  |
| `src/lib/page-download.tsx`   | `theme-quiet-paper-print`                           | Print margin uses the same accent.                              |
| `src/components/sidebar.tsx`  | `frame-quiet-paper-rail`                            | 232px rail, saved collapse, phone drawer optional.              |
| `src/app/[locale]/banks/[bankId]/page.tsx` | `frame-quiet-paper-shell`              | Bottom tab bar and room for it under the page.                  |
| `src/components/bank-selector.tsx` | `frame-quiet-paper-bar`                       | Command menu and a 44px theme control in the top bar.           |

The recursive registry accepts registered `brain-`, `theme-` and `frame-` namespaces, with
unique paired markers and exact file matching.
