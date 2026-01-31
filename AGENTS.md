# AGENTS

## Purpose

PiggyChick is a local Bun-powered viewer for `.tasks` PRD folders. It serves the client bundle from `dist/` and exposes APIs that read `.tasks` contents.

## Commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run lint`

## Structure

- `src/server/`: Bun server entry (`index.ts`).
- `src/client/`: client entry (`main.ts`), `index.html`, and `styles.css`.
- `.tasks/`: PRD folders containing `plan.md` and `plan.json` (optional `memory.md`, `learning.md`).
- `dist/`: built client assets.

## Conventions

- Keep `.tasks` path handling safe and scoped to the `.tasks` root.
- Preserve the split between server and client; update both when behavior crosses the boundary.
- Maintain dark-by-default theme with light toggle persistence.
- Validate dynamic doc IDs (reserved names, trailing dot/space, NUL, length caps, and reserved `plan`).
- Exclude symlinked or hard-linked Markdown files consistently in list/read paths.
- Resolve real paths before scanning and guard reads against TOCTOU/atomic replace pitfalls.
- Sort docs with `Intl.Collator` and de-duplicate case-insensitively for stable ordering.

## Learnings

- Centralize startup logic in a shared function and inject distRoot/tasksRoot for reuse.
- Keep path safety checks anchored to realpath boundaries even when roots are configurable.
- Use a single startup path and toggle behavior differences via environment variables.
- Validate packaged assets at startup and include the effective path in error messages.
- Standardize server env vars to `PGCH_*` and remove legacy names from code and UI.
- Fix `dist` resolution to the packaged `dist/` and avoid override env vars or wrapper injection.
- Centralize tasks root resolution in the shared helper and keep the fallback untouched when `PGCH_TASKS_ROOT` is unset.
- Resolve tasks roots via `resolve(process.cwd(), value)` so relative and absolute inputs behave consistently.
- Use `cross-env` in scripts when setting `PGCH_TASKS_ROOT` to keep Windows shells working.
- Document `PGCH_TASKS_ROOT` with both POSIX and PowerShell examples to prevent shell-specific confusion.
- Reuse TOCTOU-safe file helpers (e.g., `readTextFileWithin`) when reading `plan.json` for PRD listings; on failure, fall back to `not_started` instead of breaking the list.
- Normalize malformed task entries (non-objects or missing `passes`) to keep progress computation resilient.
- Keep sidebar status icons aligned by giving the label `flex: 1` and `min-width: 0` in a flex row, and add `role="img"` with `aria-label` for emoji indicators.
- Handle `.git` as a directory, file, or symlink and resolve `gitdir:` paths relative to the `.git` file location.
- Return `null` on git metadata errors or detached HEAD to keep listing APIs stable.
- Wrap localStorage access in try/catch and keep UI state toggles functional when storage is unavailable.
- Bun `coverageThreshold` expects singular keys (`line`, `function`, `statement`) to avoid false failures.
- Keep `coverageDir` set to `./coverage` and ignore `coverage/` in version control.

## Notes for changes

- If you change file outputs or asset names, update the `dev:client` and `build:client` scripts.
- Favor minimal README updates: commands, `.tasks` requirements, and UI behavior.
- For local development and verification, do not access npm registries; use local commands and entry points only.

## Post-implementation verification

Complete the following before committing.

- `bun run lint`
- `bun run fmt`
- `bun run typecheck`
- `bun run test`
