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
