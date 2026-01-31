# PiggyChick Server

PiggyChick is a local Bun-powered viewer for `.tasks` PRD folders. It renders GitHub-flavored Markdown with Mermaid diagrams and shows a dependency graph for `plan.json`, with a dark-only theme.

## Setup

```bash
bun install
```

## Development

```bash
bun run dev
```

This runs the Bun server and the client build watcher. Open the URL printed by the server (default: `http://localhost:3000`).

## Build

```bash
bun run build
```

This generates the static client bundle in `dist/`.

## Lint

```bash
bun run lint
```

## .tasks Requirements

Each PRD directory must live under `./.tasks/` and include:

- `plan.md`
- `plan.json`

Optional files (shown in the UI when present):

- Any additional `.md` files in the PRD folder (except `plan.md`)

Only directories that include both `plan.md` and `plan.json` are listed.
Only safe Markdown filenames are surfaced (no path separators, reserved device names, trailing dots/spaces, or other invalid IDs).

## UI Overview

- **Sidebar tree**: Select a PRD and one of its documents (`plan` plus any extra Markdown files).
- **Plan view**: Split pane with Markdown on the left and a Mermaid dependency graph on the right.
- **Theme**: Dark only.
- **No extra docs**: PRDs without additional Markdown files show only `plan`.
- **Refresh**: Adding/removing docs requires a page reload to refresh the list.
