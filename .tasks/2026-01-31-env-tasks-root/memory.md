# Replace CLI args with env-based tasks root Implementation

## B1: Replace tasks root args with env-based resolution

### Pattern: Shared env resolver to avoid drift

Centralizing tasks root resolution into `src/shared/tasks-root.ts` prevents entry points from diverging. The helper returns the fallback unchanged when `PGCH_TASKS_ROOT` is unset, which preserves the current `.tasks` relative default in `src/server/index.ts` while keeping the CLI default absolute.

### Gotcha: Absolute paths still go through resolve

Using `resolve(process.cwd(), value)` keeps relative values anchored to the current working directory while leaving absolute values unchanged. This lets the helper accept either form without extra branching.

### Consistency: Default resolved to absolute in server entry

Passing `resolve(process.cwd(), ".tasks")` as the server fallback keeps the same target directory while aligning the tasks root representation with the CLI path.

### Compatibility: Preserve CLI argument forwarding in Node path

Node-based execution continues to forward CLI arguments to the Bun child so future options can be added without diverging between Bun and Node entry paths.

## B2: Update package scripts for env-based tasks root

### Pattern: Cross-platform env vars in npm scripts

Switching the `dev` script to `cross-env PGCH_TASKS_ROOT=...` keeps the same behavior on Windows shells, which do not support the POSIX-style `VAR=value` prefix.

### Release: Include shared helper in package files

Because package publishing is restricted by the `files` list, adding new shared modules requires updating that list to avoid missing-module errors after install.

## D1: Document env-based tasks root usage

### Documentation: Pair POSIX and PowerShell examples

Including both POSIX and PowerShell snippets prevents confusion about how to set `PGCH_TASKS_ROOT` across shells, especially now that positional arguments are no longer used.
