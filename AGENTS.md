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

## Notes for changes
- If you change file outputs or asset names, update the `dev:client` and `build:client` scripts.
- Favor minimal README updates: commands, `.tasks` requirements, and UI behavior.
