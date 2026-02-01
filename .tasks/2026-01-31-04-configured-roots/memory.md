# Configurable Roots and Multi-Root Sidebar Implementation

## B1: Config utilities (JSONC, paths, normalization)

- Treat JSONC comments as whitespace (preserve newlines) to avoid accidental token concatenation during parsing.
- Reject array-shaped config payloads early; only object-shaped config is accepted.
- Validate tasks directory names to block Windows drive-like tokens (e.g., `:`) and other unsafe characters.
- Comment-only config files should parse to an empty object and fall back to defaults.

## B2: CLI commands and startup integration

- Centralize startup validation to reuse dist root resolution and index.html checks across CLI and direct server entry.
- Resolve the package root by walking up to find package.json so dist resolution is consistent in dev and packaged runs.

## B3: Server multi-root API and tasks aggregation

- Root IDs are derived from a sha1 hash of the normalized project root path, with deterministic suffixing for collisions.
- /api/roots endpoints load config on demand and map rootId back to the normalized root for read/remove operations.

## F1: Client API + state for multi-root

- Hashes now encode selection as `rootId:prdId`, with canonicalization to remove extra segments.
- Mobile select options are built from root/prd pairs with root label/branch prefixes.

## F2: Sidebar rendering, toolbar, and emoji actions

- Sidebar now renders a per-root header with emoji copy/remove actions and a sticky footer toolbar for adding roots.
- Copy feedback uses button state styling while keeping the emoji label short.

## D1: README updates for new config flow

- Documented config file location, CLI commands, and per-root tasksDir overrides in README.

