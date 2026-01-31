# Unified PRD Markdown View Implementation

## F1: Convert selection to PRD-only and update navigation UI

- Canonicalize hashes to `#/prdId` while accepting legacy `#/prdId/doc` by ignoring extra segments.
- Mobile selector values now encode only PRD IDs; keep root label/branch prefix formatting unchanged.
- Sidebar PRD rows are single buttons with label flex sizing to keep the progress emoji aligned.

## F2: Render unified markdown view with plan graph preserved

- Normalize doc IDs defensively (trim, strip `.md`, case-insensitive de-dupe) before sorting and fetching.
- Render each markdown file as its own block in the plan pane and add a small header for non-plan sections.
- Guard against stale renders by comparing a request token before applying success or error states.
