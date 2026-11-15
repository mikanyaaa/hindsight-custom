# AGENTS.md

See [CLAUDE.md](./CLAUDE.md) for project documentation and coding conventions.

## GitHub Actions

Cloud agents run the relevant tests, lint, and build on their own VM before pushing. Push only when those checks are green. Open the pull request as a draft while iterating, and mark it ready for review when the branch should be checked.

Checks are path-scoped: an API change runs the API check, and a UI change runs the UI check. CI runs from pull requests. Release, publish, docs deploy, and scheduled upstream workflows stay manual and limited to the upstream repository.
