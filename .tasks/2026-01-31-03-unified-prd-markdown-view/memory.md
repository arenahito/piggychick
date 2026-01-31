# Unified PRD Markdown View Implementation

## F1: Convert selection to PRD-only and update navigation UI

- Canonicalize hashes to `#/prdId` while accepting legacy `#/prdId/doc` by ignoring extra segments.
- Mobile selector values now encode only PRD IDs; keep root label/branch prefix formatting unchanged.
- Sidebar PRD rows are single buttons with label flex sizing to keep the progress emoji aligned.
