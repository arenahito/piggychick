# Config File Editor View Implementation

## B1: Add config text helpers and API endpoints

- Keep config text validation aligned with load/normalize behavior so API writes do not accept schemas that reads will later reject.
- Reject non-string per-root `tasksDir` values during normalization to avoid silent override drops.
- Use temp file + rename with fallback cleanup to reduce partial-write risk when saving config text.

## F1: Add config editor view and wiring

- Guard async save flows with a request token or active-handle checks to avoid updating a closed editor.
- Disable the Settings button while the editor is open to prevent accidental reloads that drop unsaved edits.
- Clear toast timers on close so stale timeouts do not affect the next editor session.
