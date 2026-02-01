# Sidebar PRD List Sorting and Controls Implementation

## B1: Add PRD sort parameter to API and server helpers

- Normalizing `prdSort` with `trim().toLowerCase()` avoids surprising fallbacks when query params include whitespace.
- Applying the same sort order to POST/DELETE responses prevents ordering shifts when UI reuses those payloads.

## F1: Request descending PRD order from the client API

- `fetchRoots` is the single place to apply the `prdSort=desc` query parameter; tests should stub against the full URL with the query string.

## F2: Add sidebar filtering, limits, and toolbar controls

- Filtering incomplete PRDs should use `normalizeProgress` so missing or invalid progress still counts as incomplete.
- When a filter hides the active selection in the mobile selector, a disabled placeholder option prevents the UI from implying a different active PRD.
- Pruning stored per-root UI state to known root IDs avoids leaking stale localStorage entries after root changes.

## F3: Style new sidebar controls

- Keep emoji-only buttons using the base pill button style but override letter spacing and text transform to avoid distorted emoji rendering.
- Pair a hidden checkbox with a visible switch track to preserve accessibility while custom-styling the toggle UI.
