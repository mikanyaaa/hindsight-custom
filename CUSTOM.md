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
