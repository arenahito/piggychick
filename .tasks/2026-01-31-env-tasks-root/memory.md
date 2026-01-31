# Replace CLI args with env-based tasks root Implementation

## B1: Replace tasks root args with env-based resolution

### Pattern: Shared env resolver to avoid drift

Centralizing tasks root resolution into `src/shared/tasks-root.ts` prevents entry points from diverging. The helper returns the fallback unchanged when `PGCH_TASKS_ROOT` is unset, which preserves the current `.tasks` relative default in `src/server/index.ts` while keeping the CLI default absolute.

### Gotcha: Absolute paths still go through resolve

Using `resolve(process.cwd(), value)` keeps relative values anchored to the current working directory while leaving absolute values unchanged. This lets the helper accept either form without extra branching.
