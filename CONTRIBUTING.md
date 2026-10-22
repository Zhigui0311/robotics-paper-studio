# Contributing

Use Node.js 24, pnpm 11.25.0 and Python 3.9+. Install with `pnpm install --frozen-lockfile`.

Before submitting a change:

```sh
pnpm typecheck
pnpm test
pnpm test:skill
pnpm build
```

Describe the behavior changed, how it was verified, and any evidence or compatibility limits. Add an entry to `CHANGELOG.md`. Keep database migrations append-only. Do not include real papers, personal notes, credentials or runtime state in patches or test fixtures.

Skill changes belong in `skills/robotics-paper-workbench/`; explicitly add new source files to Git, then run `pnpm package:skill` to refresh the download. Untracked local notes are excluded from the ZIP. Paper analysis must distinguish actual full-text reading from extracted text or abstract-only evidence. Preserve user-authored notes when updating analyses.

The app uses server-side storage and authenticated requests. GitHub Pages alone cannot run it; see `docs/deployment.md`.
