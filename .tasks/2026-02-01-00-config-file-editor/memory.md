# Config File Editor View Implementation

## B1: Add config text helpers and API endpoints

- Keep config text validation aligned with load/normalize behavior so API writes do not accept schemas that reads will later reject.
- Reject non-string per-root `tasksDir` values during normalization to avoid silent override drops.
- Use temp file + rename with fallback cleanup to reduce partial-write risk when saving config text.
