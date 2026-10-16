# Customized Hindsight

This is a **public customized copy** of [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight) (MIT License) with a customized Hindsight UI/control plane for a self-hosted instance. Upstream code, history and attribution are preserved unchanged; see [LICENSE](LICENSE). Development originally happened in a private mirror, so PR numbers mentioned in these docs refer to that private development repo.

## Where the UI lives
- `hindsight-control-plane/`: Next.js (App Router) + React + Tailwind + Radix/shadcn, TypeScript.
  - Pages: `src/app/[locale]/...` (i18n via `src/i18n`, `src/messages`). Add custom views as new route folders here.
  - Server-side API proxy routes: `src/app/api/...`; they call the Hindsight API (dataplane) via `src/lib/hindsight-client.ts`.
  - Env: `HINDSIGHT_CP_DATAPLANE_API_URL` (default `http://localhost:8888`), `HINDSIGHT_CP_DATAPLANE_API_KEY`, `HINDSIGHT_CP_ACCESS_KEY` (UI login), `NEXT_PUBLIC_BASE_PATH`.
  - Dev: `npm install` at repo root, then `npm run dev -w @vectorize-io/hindsight-control-plane` (port 9999).
- Docker: `docker/standalone/Dockerfile` (stages `cp-builder`, `cp-only`; Next.js standalone output). Compose files in `docker/docker-compose/`.

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
| `.github/workflows/test.yml` | `build-docker-images` (`if:`) | `has_secrets == 'true'` OR not upstream, so image builds still run in the mirror |
| `.github/workflows/test.yml` | `build-docker-images` steps "Setup GCP credentials for smoke test" and "Smoke test - verify container starts" | only upstream, or the `control-plane` leg (needs no credentials); api-slim / standalone-slim smoke tests are upstream-only |
| `.github/workflows/perf-test.yml` | `perf-test`, `amb`, `obs`, `system-evals` | `if: github.repository == 'vectorize-io/hindsight'` (scheduled daily run) |
| `.github/workflows/security-scan.yml` | `scan-published`, `scan-next-build` | `if: github.repository == 'vectorize-io/hindsight'` (scheduled daily run) |

Kept running in the mirror: `detect-changes`, `build-control-plane` (lint/typecheck/vitest/build), Docker control-plane build + smoke test, `check-unused-code`, `verify-generated-files`, `typecheck-api`, `build-*`, `check-*`, lint-helm-chart, `test-system`, and the integration unit-test jobs that need no secrets.

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
links here instead of maintaining a second directory. Every marker in `src/` must
use a unique `brain-` name with paired begin/end comments, and every registered
name must exist in the listed source file. The recursive hook-registry test
rejects unregistered, malformed, unpaired and orphaned entries.

The shared constellation has only **three** hook pairs. It dispatches to
`brainRenderer.render` only behind the exact flag; the network component body is
otherwise identical to upstream. The custom renderer owns scene preparation,
Canvas lifecycle, mouse/wheel events, resize/fullscreen, safe hover labels,
SVG download and toolbar. It reuses the existing custom drawing primitives,
without copying the upstream renderer or adding new interaction capabilities.

| File | Marker names | Purpose |
| --- | --- | --- |
| `src/components/constellation.tsx` | `brain-network-imports` | Type-only renderer contract and the small exact-flag helper. |
| `src/components/constellation.tsx` | `brain-network-contract` | Optional renderer object; existing callers keep their defaults. |
| `src/components/constellation.tsx` | `brain-network-dispatch` | Flag-gated renderer-object entry; otherwise mount the unchanged network component. Euler views also stay upstream. |
| `src/components/data-view.tsx` | `brain-network-entry` | Flag-gated lazy memory renderer and small mode/limit helpers. |
| `src/components/data-view.tsx` | `brain-network-mode` | Custom mode state; storage effects are inert when disabled. |
| `src/components/data-view.tsx` | `brain-network-active` | Apply the brain budget only while its graph is visible; table/timeline retain normal limits. |
| `src/components/data-view.tsx` | `brain-network-request-limit` | Positive limit capped at 500 only in brain mode; preserve bank/filter fields. |
| `src/components/data-view.tsx` | `brain-network-request-signature`, `brain-network-request-deps` | Reload on layout budget changes; normal signature stays identical. |
| `src/components/data-view.tsx` | `brain-network-view` | Replace this call site only; pass custom mode controls. |

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
