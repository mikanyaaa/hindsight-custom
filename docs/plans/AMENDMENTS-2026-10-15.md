# Amendments to `ai-brain-network.md` (2026-10-15)

**Audience:** AI agents (ChatGPT/GPT, Grok Bot, coding agents) reviewing or implementing the plan.
**Status:** Approved by the maintainer. Plan is still **not implemented**.
**Precedence:** This file **supersedes any conflicting point** in `docs/plans/ai-brain-network.md`. Do not edit that file; revise your understanding of it using this one. Where this file is silent, the original plan stands.

**Task for GPT:** Review the original plan against these amendments and produce a revised plan (as a new doc, not an edit of the original) that is consistent with all points below.

---

## 1. Custom code isolation

- Put all custom code in its own folder, e.g. `hindsight-control-plane/src/custom/brain/`, **not** in `lib/brain-*` or other upstream-owned locations.
- Touch shared upstream files only with minimal, clearly marked hooks (e.g. `// CUSTOM-HOOK: brain-network begin/end`). Hotspots: `constellation.tsx`, `data-view.tsx`, `src/messages/*.json`.
- Custom i18n strings go in a separate namespace/file if next-intl allows it; only add to `src/messages/*.json` if unavoidable (keep it a tiny, marked diff).
- Everything sits behind a feature flag. Default: off, or default to the existing network layout. With the flag off, behavior must be identical to upstream.

## 2. Upstream-sync checklist (upstream: `vectorize-io/hindsight`, very active)

Hotspot files: `constellation.tsx`, `data-view.tsx`, `src/messages/*.json`, plus any other file that carries a `CUSTOM-HOOK` marker.

Maintain a list of all hooks (file, marker, purpose) in the plan doc. To sync:
1. Work on a topic branch (e.g. `chore/upstream-sync-YYYY-MM-DD`); never on `main` directly.
2. `git fetch upstream` and merge or rebase `upstream/main`. Never force-push; prefer merge if the branch is already pushed.
3. Resolve conflicts in hotspot files by taking upstream's version, then **re-apply the hooks**: `grep -rn "CUSTOM-HOOK" hindsight-control-plane/src` to find what is missing, and re-insert from the hook list.
4. Verify that `src/custom/brain/` still compiles against upstream's changed types/props; adapt only the custom code where possible.
5. Run lint, typecheck, tests and build, with the flag both on and off. Report only what was actually run.
6. Open a PR; no deploy.

## 3. Neon style guide

- Reference: Hindsight document `design-style-kurzgesagt-neon` (private bank).
- Palette principle: dark desaturated background + 2–3 saturated neons + white highlight. Example: bg `#0B0726`, neons `#9D00FF`, `#FF007F`, `#00FFFF`.
- Look: flat vector, no outlines, neon bloom on emissive elements only, layered parallax depth.
- Inspiration only. Do **not** copy Kurzgesagt characters, logo, or name.

## 4. Roadmap (later; NOT part of PR 1)

Each item gets its own plan doc **before** any implementation:
- Global neon theme as a separate theme override layer, loaded after `globals.css` (colors, fonts, shadcn tokens).
- A Soul/personality view.
- A projects view.

## 5. Recommended first PR

Pure geometry/layout code plus tests only, in the custom folder. **No UI change**, no hooks wired yet.

## 6. Workflow rules

- Topic branches and PRs only. Never force-push. Do not touch `main` directly.
- No secrets or tokens in code, chats, or logs.
- No deploy without the maintainer's explicit request.
- Do not weaken CSP.
- Never claim checks passed that were not run.
- Hosting context: runs on a self-hosted server behind an external access proxy. The control plane's own login (`HINDSIGHT_CP_ACCESS_KEY`) must keep working alongside it; do not remove or bypass either.
