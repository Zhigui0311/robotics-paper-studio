# Repository workflow

This project’s owner requests ongoing GitHub version history for completed changes.

Canonical public repository: https://github.com/Zhigui0311/robotics-paper-studio (main).

- Read the current tree and preserve user changes. Never force-push or rewrite published history.
- For each completed source change, run appropriate checks, update the changelog, and commit a concise description of what changed. Push to the configured GitHub remote when credentials are available. If pushing is unavailable, retain the local commit and state the specific blocker; do not claim synchronization.
- When local Git authentication is unavailable, use the connected GitHub tools to create blobs/trees/commits and update `main` with the expected current SHA. Fetch the resulting history locally; preserve existing prepared commits separately. This repository is authorized for the ChatGPT Codex Connector. Use existing repository access rather than requesting broader account access.
- Increment `package.json` for a release: patch for fixes, minor for compatible features, major for breaking changes. Keep `CHANGELOG.md` and `vX.Y.Z` tags aligned. Routine commits do not each require a release.
- The website and `skills/robotics-paper-workbench/` are the project source. Rebuild the downloadable Skill with `python3 scripts/package-skill.py` after Skill changes. Preserve its independent version and license.
- Run `pnpm typecheck`, `pnpm test`, `pnpm test:skill` and `pnpm build` for behavior changes. Documentation-only changes need targeted validation.
- When working from a Sites-managed checkout with a real `project_id`, follow the Sites workflow for that site. Use `scripts/export-public.py` for GitHub distribution. The ignored `.sites-runtime/github-sync.json` can identify the local public checkout and its verified remote. Reconcile incoming GitHub changes before exporting over them.
- Never publish personal papers, notes, library exports, runtime databases, environment values, credentials or machine-specific configuration. The public hosting manifest has no existing `project_id`.
- Preserve the current website audience. Making the source public does not authorize publishing any user’s research data or changing application access.

Version and release procedures are in `docs/versioning.md`.
