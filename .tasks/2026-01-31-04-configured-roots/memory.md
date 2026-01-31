# Configurable Roots and Multi-Root Sidebar Implementation

## B1: Config utilities (JSONC, paths, normalization)

- Treat JSONC comments as whitespace (preserve newlines) to avoid accidental token concatenation during parsing.
- Reject array-shaped config payloads early; only object-shaped config is accepted.
- Validate tasks directory names to block Windows drive-like tokens (e.g., `:`) and other unsafe characters.
- Comment-only config files should parse to an empty object and fall back to defaults.

