# Implementation Plan: Replace CLI args with env-based tasks root

## Overview

Switch tasks root selection from positional CLI arguments to an environment variable, keeping default behavior unchanged when the env var is not set.

## Goal

PiggyChick resolves the tasks root from a `PGCH_TASKS_ROOT` environment variable (supporting relative paths), and no longer uses CLI arguments for tasks root. Defaults remain identical to the current behavior.

## Scope

- Included: tasks root resolution changes in CLI entry points, shared resolution helper, package scripts update, README update
- Excluded: changes to `.tasks` structure, API behavior, or path safety validation logic

## Prerequisites

- Understanding of current CLI entry points (`bin/pgch.js`, `src/cli.ts`, `src/server/index.ts`)
- Ability to run `bun` commands locally

## Design

### Tasks Root Resolution

Introduce a shared helper to avoid drift between entry points.

- New helper `resolveTasksRootFromEnv(fallback: string)` in `src/shared/tasks-root.ts`:
  - Read `process.env.PGCH_TASKS_ROOT` and trim whitespace.
  - If unset or empty, return `fallback` as-is.
  - Otherwise, return `resolve(process.cwd(), value)`.
    - `resolve` returns the absolute path as-is when `value` is already absolute, so behavior is consistent for both absolute and relative inputs.

Entry points use the helper with their existing defaults:

- `src/cli.ts`: pass `resolve(process.cwd(), ".tasks")` as fallback.
- `src/server/index.ts`: pass `".tasks"` as fallback (keep relative default).
- `bin/pgch.js`: rely on `runCli()` to resolve from env; do not parse tasks root from `process.argv`.

All entry points ignore positional arguments for the tasks root. Argument forwarding may remain for future flags, but tasks root is never derived from `process.argv`.

### Flow

```mermaid
flowchart TD
    A[Start] --> B{PGCH_TASKS_ROOT set?}
    B -- No --> C[Use entry point fallback]
    B -- Yes --> D{Value empty/whitespace?}
    D -- Yes --> C
    D -- No --> E[Resolve env path (relative -> cwd)]
    E --> F[Start server with tasksRoot]
    C --> F
```

## Decisions

| Topic | Decision | Rationale |
| --- | --- | --- |
| Env var name | `PGCH_TASKS_ROOT` | Matches existing `PGCH_*` env var convention in `src/server/app.ts` |
| Relative path base | `process.cwd()` | Matches current default resolution for CLI/binary |
| Args behavior | Ignore positional tasks-root argument; forward other args unchanged | Removes path-based arg usage while keeping future flags possible |
| Empty env var | Treat as unset | Avoid surprising resolution to `cwd/""` |
| Scripts portability | Use `cross-env` in `dev` script | Avoid Windows env syntax regressions |

## Tasks

### B1: Replace tasks root args with env-based resolution

- **ID**: `302d8853-2d26-4382-9e34-072434f0be72`
- **Category**: `backend`
- **File(s)**: `src/cli.ts`, `bin/pgch.js`, `src/server/index.ts`, `src/shared/tasks-root.ts`

#### Description

Remove positional argument handling for the tasks root and resolve it from `PGCH_TASKS_ROOT` in all entry points while preserving default behavior when the env var is not set.

#### Details

- Add `src/shared/tasks-root.ts`:
  - Export `resolveTasksRootFromEnv(fallback: string)`.
  - Implement trimming and empty handling.
  - Use `resolve(process.cwd(), value)` for env-specified paths (absolute values remain unchanged by `resolve`).
- `src/cli.ts`:
  - Replace `resolveTasksRoot(process.argv[2])` with the shared helper.
  - Keep the fallback as `resolve(process.cwd(), ".tasks")` to preserve current default.
- `bin/pgch.js`:
  - Remove tasks-root parsing from `process.argv`.
  - In Bun path: call `runCli()` without `tasksRoot` override.
  - In Node path: forward arguments unchanged to Bun, but do not interpret any positional arg as tasks root.
- `src/server/index.ts`:
  - Stop reading `process.argv[2]` and use the shared helper.
  - Keep default as `.tasks` when env var is not set.

Edge cases:
- Env var set to whitespace only -> treat as unset.
- Env var set to relative path -> resolve from cwd.
- Env var set to absolute path -> resolve as-is.

#### Acceptance Criteria

- [ ] No code path reads `process.argv[2]` for tasks root
- [ ] `PGCH_TASKS_ROOT` controls tasks root across CLI/binary/server
- [ ] When `PGCH_TASKS_ROOT` is not set, tasks root defaults match current behavior

### B2: Update package scripts for env-based tasks root

- **ID**: `52150305-5a19-46cb-84af-44758df44002`
- **Category**: `backend`
- **File(s)**: `package.json`

#### Description

Adjust scripts to stop passing a positional tasks root and use `PGCH_TASKS_ROOT` where needed, without breaking Windows usage.

#### Details

- Add `cross-env` to `devDependencies` if not present.
- `start`: remove `.tasks` positional argument.
- `dev`: replace `./example/.tasks` positional argument with `cross-env PGCH_TASKS_ROOT=./example/.tasks` for the server command inside `concurrently`.
- Do not change `dev:client` and `build:client`.

#### Acceptance Criteria

- [ ] `bun run start` works without positional args
- [ ] `bun run dev` uses `PGCH_TASKS_ROOT` to target `./example/.tasks`
- [ ] `bun run dev` works on Windows shells (via `cross-env`)

### D1: Document env-based tasks root usage

- **ID**: `6884a7d9-7a2a-4478-935e-6a62ed90a076`
- **Category**: `documentation`
- **File(s)**: `README.md`

#### Description

Update README to describe `PGCH_TASKS_ROOT` usage and remove mention of positional args.

#### Details

- Replace the CLI argument description with an env var section.
- Include short examples for POSIX and Windows PowerShell.
- Keep documentation in English.

#### Acceptance Criteria

- [ ] README no longer mentions positional tasks root arguments
- [ ] README includes `PGCH_TASKS_ROOT` usage with relative path examples for POSIX and Windows

## Verification

0. If `cross-env` is newly added, run `bun install` once to fetch it.
1. Run `bun run lint` (should pass)
2. Manual check (POSIX):
   - `PGCH_TASKS_ROOT=./example/.tasks bun run dev` starts with example data
   - `bun run start` (no env var) still targets `./.tasks`
3. Manual check (PowerShell):
   - `$env:PGCH_TASKS_ROOT = "./example/.tasks"; bun run dev`
   - `Remove-Item Env:PGCH_TASKS_ROOT; bun run start`
