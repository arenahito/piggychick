# PiggyChick Server

PiggyChick is a local Bun-powered viewer for `.tasks` PRD folders. It renders GitHub-flavored Markdown with Mermaid diagrams and shows a dependency graph for `plan.json`, with a dark-by-default theme and a light toggle that persists.

## Setup

```bash
bun install
```

## CLI Usage

Run without installing:

```bash
bunx @arenahito/piggychick
# or
npx @arenahito/piggychick
```

Install globally and use the `pgch` alias:

```bash
bun add -g @arenahito/piggychick
pgch
```

Install locally and run via bunx:

```bash
bun add @arenahito/piggychick
bunx pgch
```

The CLI reads `.tasks` from your current working directory by default. Set `PGCH_TASKS_ROOT` to override it (relative paths are resolved from the current working directory).
Bun is required at runtime.

POSIX:

```bash
PGCH_TASKS_ROOT=./example/.tasks pgch
```

PowerShell:

```powershell
$env:PGCH_TASKS_ROOT = "./example/.tasks"
pgch
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

## Format

```bash
bun run fmt
```

```bash
bun run fmt:check
```

Formats code. `fmt:check` verifies formatting without writing files.

## Type Check

```bash
bun run typecheck
```

Type-checks with tsgo.

## Test

```bash
bun test
```

Tests enforce 90% coverage thresholds via `bunfig.toml`.
Thresholds apply to line/function/statement coverage; excluded paths are listed in `bunfig.toml`.

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
- **Theme**: Dark by default with a persistent light toggle.
- **No extra docs**: PRDs without additional Markdown files show only `plan`.
- **Refresh**: Adding/removing docs requires a page reload to refresh the list.
