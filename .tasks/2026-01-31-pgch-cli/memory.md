## B1: Refactor server startup to accept dist root
- Moved Bun.serve setup into startServer with explicit distRoot and tasksRoot to allow reuse by CLI and dev entry.
- Kept static file safety checks anchored to the realpath of distRoot, ensuring isWithinRoot guards still use the provided root.
- Preserved OPEN_BROWSER environment gating inside the shared startServer so callers can opt out while keeping existing behavior.
