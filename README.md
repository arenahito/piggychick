# PiggyChick Server

PiggyChick is a local Bun-powered viewer for tasks directories configured in `~/.config/piggychick/config.jsonc`. It renders GitHub-flavored Markdown with Mermaid diagrams and shows a dependency graph for `plan.json`, with a dark-by-default theme and a light toggle that persists.

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

The CLI reads project roots from `~/.config/piggychick/config.jsonc`. Use `pgch add` to add a project root (uses the current working directory when omitted), and `pgch remove` to delete it. Bun is required at runtime.

```bash
pgch config   # show config path
pgch list     # list configured roots
pgch add      # add current directory as a root
pgch add ./path/to/project
pgch remove ./path/to/project
```

If no roots are configured, the UI shows no PRDs.

### Config File

Location: `~/.config/piggychick/config.jsonc`

```jsonc
{
  // PiggyChick config
  "tasksDir": ".tasks",
  "roots": [
    { "path": "/abs/path/to/project" },
    { "path": "/abs/path/to/other-project", "tasksDir": ".tasks-prd" }
  ]
}
```

- `tasksDir` defaults to `.tasks` when omitted or blank.
- `roots` entries can override `tasksDir` per root by editing the config file.

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

## Tasks Directory Requirements

Each PRD directory must live under the configured tasks directory (default: `./.tasks/`) and include:

- `plan.md`
- `plan.json`

Optional files (shown in the UI when present):

- Any additional `.md` files in the PRD folder (except `plan.md`)

Only directories that include both `plan.md` and `plan.json` are listed.
Only safe Markdown filenames are surfaced (no path separators, reserved device names, trailing dots/spaces, or other invalid IDs).

## UI Overview

- **Sidebar tree**: Lists all configured roots and their PRDs.
- **Plan view**: Split pane with Markdown on the left and a Mermaid dependency graph on the right.
- **Theme**: Dark by default with a persistent light toggle.
- **No extra docs**: PRDs without additional Markdown files show only `plan`.
- **Refresh**: Adding/removing docs requires a page reload to refresh the list.
