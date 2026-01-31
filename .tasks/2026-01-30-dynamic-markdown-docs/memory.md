## B1: Dynamic Markdown discovery and routing
- Added doc ID validation beyond traversal: reserved device names, trailing dot/space, NUL, length cap, and reserved "plan".
- Hardened file reads with realpath checks, O_NOFOLLOW when available, dev/ino comparison, nlink checks, and a single retry to reduce TOCTOU/atomic replace issues.
- Aligned list and read behavior by excluding symlinked or hard-linked Markdown files in both listing and read paths.
- Resolved PRD directories to real paths before scanning to avoid junction escapes.
- Sorted docs with Intl.Collator and de-duplicated case-insensitively for stable ordering.

## F1: Client navigation for dynamic docs
- Switched PRD summaries to a dynamic docs list and updated hash encoding/decoding for doc IDs.
- Normalized hash parsing for missing/empty docs and avoided double-loads after hash correction.
- Ensured selection falls back to plan when a doc is unknown and rewrites the URL consistently.
- Mobile selector now encodes/decodes doc IDs to support spaces and special characters.

## D1: Documentation update
- Documented dynamic Markdown discovery, safe filename constraints, and the need to reload to refresh the list.
