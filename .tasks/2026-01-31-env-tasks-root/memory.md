# Replace CLI args with env-based tasks root Implementation

## B1: Replace tasks root args with env-based resolution

### Pattern: Shared env resolver to avoid drift

Centralizing tasks root resolution into `src/shared/tasks-root.ts` prevents entry points from diverging. The helper returns the fallback unchanged when `PGCH_TASKS_ROOT` is unset, which preserves the current `.tasks` relative default in `src/server/index.ts` while keeping the CLI default absolute.

### Gotcha: Absolute paths still go through resolve

Using `resolve(process.cwd(), value)` keeps relative values anchored to the current working directory while leaving absolute values unchanged. This lets the helper accept either form without extra branching.

## B2: Update package scripts for env-based tasks root

### Pattern: Cross-platform env vars in npm scripts

Switching the `dev` script to `cross-env PGCH_TASKS_ROOT=...` keeps the same behavior on Windows shells, which do not support the POSIX-style `VAR=value` prefix.

## D1: Document env-based tasks root usage

### Documentation: Pair POSIX and PowerShell examples

Including both POSIX and PowerShell snippets prevents confusion about how to set `PGCH_TASKS_ROOT` across shells, especially now that positional arguments are no longer used.
