## B1: Refactor server startup to accept dist root
- Moved Bun.serve setup into startServer with explicit distRoot and tasksRoot to allow reuse by CLI and dev entry.
- Kept static file safety checks anchored to the realpath of distRoot, ensuring isWithinRoot guards still use the provided root.
- Preserved OPEN_BROWSER environment gating inside the shared startServer so callers can opt out while keeping existing behavior.

## X1: Add CLI bin that launches server from packaged assets
- Added a Node-friendly bin that detects Bun, resolves the package dist root, and forwards it via PGCH_DIST_ROOT for the Bun entrypoint.
- Centralized CLI startup in src/cli.ts so both direct Bun execution and Node-spawned Bun share the same tasksRoot/distRoot resolution and dist existence checks.
- Dist root checks now include the effective path in error messages to avoid confusion when overriding PGCH_DIST_ROOT.
