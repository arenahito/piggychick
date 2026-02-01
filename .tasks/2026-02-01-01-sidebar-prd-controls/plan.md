# Implementation Plan: Sidebar PRD List Sorting and Controls

## Overview

Add API-driven PRD sorting, sidebar list limits with per-root expansion, global open/close controls, and an incomplete-only filter that also applies to the mobile selector. Persist sidebar UI state across reloads.

## Goal

The sidebar PRD list is sorted by PRD name descending via an API parameter, shows at most five PRDs per root by default with expandable overflow, offers global open/close-all controls, and supports an incomplete-only filter that persists and applies to the mobile selector without changing the current selection.

## Scope

- Included:
  - API query parameter to control PRD sort order for roots listing
  - Sidebar per-root PRD limit (max 5) with expand/collapse when more exist
  - Toolbar controls for open-all, close-all, and incomplete-only filter (emoji-only)
  - Persistence of sidebar UI state in localStorage
  - Mobile selector respects the incomplete-only filter
- Excluded:
  - Changes to PRD content rendering or markdown handling
  - Changes to PRD progress computation semantics
  - Changes to CLI behavior or config schema

## Prerequisites

- Existing root listing and sidebar rendering remain in place

## Design

### API and server sorting

- Add a query parameter to `GET /api/roots` to control PRD sorting.
- Parameter name: `prdSort`, accepted values `asc` or `desc` (case-insensitive).
- Default behavior remains ascending when the parameter is missing or invalid.
- Sorting uses the same key as today (`prd.label`), only reversing the compare for `desc`.
- Extend server helpers:
  - `listPrds(root, { sortOrder })` supports ascending/descending ordering via `Intl.Collator("en", { sensitivity: "base", numeric: true })`.
  - `listRoots(configPath, { sortOrder })` passes the order through to `listPrds`.

### Client state and persistence

Add sidebar UI state to `src/client/main.ts`:

- `showIncompleteOnly: boolean`
- `expandedRoots: Record<string, boolean>` (per-root "show all" state)

Persist to localStorage with safe read/write:

- `pgch.sidebarCollapsedRoots` (existing)
- `pgch.sidebarExpandedRoots` (new)
- `pgch.sidebarShowIncompleteOnly` (new)

Read helpers validate the stored shape (object of booleans). Invalid values fall back to defaults.

### Sidebar rendering rules

For each root in `renderSidebar`:

1. Start with the API order (already descending).
2. If `showIncompleteOnly` is enabled, keep PRDs whose normalized progress is not `done`.
   - Use `normalizeProgress` so missing/invalid progress counts as `not_started` (incomplete).
3. If the filtered list length is greater than 5, render:
   - Top 5 PRDs when `expandedRoots[rootId] !== true`
   - All PRDs when `expandedRoots[rootId] === true`
   - A per-root toggle button that flips `expandedRoots[rootId]`
4. Root collapse (`collapsedRoots`) still hides all PRDs regardless of expansion state.
5. If the filtered list drops to 5 or fewer, hide the per-root toggle but keep the stored expansion state unchanged.

Selection behavior:

- Do not change `state.selection` when filtering hides the current PRD.
- The PRD can remain hidden; selection persists until the user chooses another PRD.

### Toolbar actions

Add emoji-only controls in the sidebar footer:

- Open all folders: set all `collapsedRoots[rootId] = false`
- Close all folders: set all `collapsedRoots[rootId] = true`
- Incomplete-only toggle: checkbox-style switch, emoji label only

All emoji controls must include `aria-label` and `title` text for accessibility. The toggle must expose state via
`role="switch"` + `aria-checked` (or a native checkbox).

### Mobile selector

`updateMobileSelect` uses the same filtered PRD list as the sidebar.
To avoid UI mismatch, if the current selection is filtered out, insert a disabled placeholder option (e.g., "Selection hidden by filter") and set it as selected so the control does not imply a different active PRD.

### Diagram

```mermaid
flowchart LR
  A[App bootstrap] --> B[GET /api/roots?prdSort=desc]
  B --> C[listRoots -> listPrds (collator order)]
  C --> D[state.roots]
  D --> E[renderSidebar]
  E --> F{showIncompleteOnly?}
  F -->|yes| G[filter done]
  F -->|no| H[all PRDs]
  G --> I[limit to 5 unless expanded]
  H --> I
  I --> J[render PRD buttons + per-root toggle]
```

### UI/UX design

- Maintain existing typography and spacing (IBM Plex Sans, `--space`, `--radius`).
- Reuse current sidebar palette (`--panel`, `--panel-soft`, `--border`, `--md-h2`) for new controls.
- Emoji-only buttons keep the existing pill-button styling with hover/focus states.
- Toggle switch aligns with existing focus-visible outlines and maintains keyboard access.

## Decisions

| Topic | Decision | Rationale |
| --- | --- | --- |
| Sort parameter | `prdSort` query param with `asc`/`desc` values, default `asc` | Backwards-compatible API while enabling descending order |
| Client ordering | Client requests `prdSort=desc` and does not re-sort | Single source of truth for ordering |
| Incomplete definition | Incomplete means `normalizeProgress(...) !== "done"` | Aligns with existing progress normalization |
| Filter and selection | Filtering can hide the current selection; selection is not changed | Matches requested behavior without auto-navigation |
| Limit behavior | Apply limit after filtering; show toggle only when filtered count > 5 | Avoids unnecessary toggles when few items remain |
| Expansion state | Keep `expandedRoots` state even when filtered count <= 5 | Prevents surprising resets when filters toggle |
| Global open/close | Open/close only affects root collapse, not per-root limit | Keeps the 5-item limit intact as requested |
| Persistence | New localStorage keys for expanded roots and filter | Preserve UI state across reloads |
| Mobile selection | Show a disabled placeholder when current selection is filtered out | Avoids UI showing a different PRD than the actual selection |

## Tasks

### B1: Add PRD sort parameter to API and server helpers

- **ID**: `886bf467-c59f-4541-8eba-21bfb442cd11`
- **Category**: `backend`
- **File(s)**: `src/server/tasks.ts`, `src/server/routes.ts`, `tests/server/tasks.test.ts`, `tests/server/routes.test.ts`

#### Description

Introduce a PRD sort-order parameter that the API can accept and pass through to server listing helpers without changing the default ordering.

#### Details

- Add `PrdSortOrder` type (`asc` | `desc`) and extend `listPrds` to accept `sortOrder`.
- Update PRD sorting in `listPrds` to respect `sortOrder` via collator compare.
- Extend `listRoots` to accept and pass `sortOrder` to `listPrds`.
- In `handleApiRequest`, read `prdSort` from `URL.searchParams` on `GET /api/roots` and normalize to `asc`/`desc`.
- Add tests:
  - `listPrds` with `sortOrder: "desc"` returns descending IDs.
  - `GET /api/roots?prdSort=desc` returns PRDs in descending order.
  - Invalid `prdSort` (including mixed case) falls back to ascending order.

#### Acceptance Criteria

- [ ] `GET /api/roots` defaults to ascending order when no param is supplied
- [ ] `GET /api/roots?prdSort=desc` returns PRDs in descending order
- [ ] Existing tests remain valid; new sort tests pass

### F1: Request descending PRD order from the client API

- **ID**: `0eddad3e-c1d3-41e7-9d89-630cb342649f`
- **Category**: `frontend`
- **File(s)**: `src/client/api.ts`, `tests/client/api.test.ts`

#### Description

Update the client API helper so the roots list is fetched with descending PRD order, and adjust tests accordingly.

#### Details

- Change `fetchRoots` to call `/api/roots?prdSort=desc`.
- Keep call sites unchanged by preserving the `fetchRoots()` signature.
- Update `tests/client/api.test.ts` expectations for the new URL.

#### Acceptance Criteria

- [ ] `fetchRoots` requests descending PRD order via query param
- [ ] API tests validate the updated URL

### F2: Add sidebar filtering, limits, and toolbar controls

- **ID**: `cb07712b-943a-4d76-84a7-2a59485a1d9d`
- **Category**: `frontend`
- **File(s)**: `src/client/main.ts`, `src/client/components/sidebar.ts`

#### Description

Implement sidebar behavior for per-root PRD limits, expansion toggles, global open/close actions, and an incomplete-only filter that persists and is shared with the mobile selector.

#### Details

- Add `showIncompleteOnly` and `expandedRoots` to client state with localStorage read/write helpers.
- Prune `collapsedRoots` and `expandedRoots` to known root IDs during `syncRoots` before persisting.
- Add handlers for:
  - Open all folders (collapse = false for each root)
  - Close all folders (collapse = true for each root)
  - Toggle incomplete-only filter
  - Toggle per-root expansion
- Update `renderSidebar` to:
  - Filter PRDs when `showIncompleteOnly` is enabled (not `done`).
  - Apply the 5-item limit after filtering.
  - Render a per-root expand/collapse button only when filtered count > 5.
  - Keep selection unchanged even if hidden by filter.
- Update `updateMobileSelect` to use the same filtered list.
- If the current selection is not present in the filtered list, insert a disabled placeholder option and select it.

#### Acceptance Criteria

- [ ] Sidebar shows at most five PRDs per root by default
- [ ] Roots with more than five PRDs provide an expand/collapse control
- [ ] Open/close-all controls expand/collapse root sections without changing the 5-item limit
- [ ] Incomplete-only filter applies to sidebar and mobile selector and persists
- [ ] Selection is not modified when the current PRD is filtered out
- [ ] Mobile selector does not display an incorrect PRD when the current selection is filtered out

### F3: Style new sidebar controls

- **ID**: `5318e89d-5dff-4502-b321-b051c38dcc3c`
- **Category**: `frontend`
- **File(s)**: `src/client/styles.css`

#### Description

Style the new toolbar controls, incomplete-only toggle, and per-root expand/collapse button so they match existing sidebar aesthetics and accessibility.

#### Details

- Extend `.sidebar-toolbar` to accommodate multiple controls with spacing and wrapping.
- Add styles for emoji-only buttons, hover/focus-visible states, and disabled states.
- Add styles for a compact toggle switch (checkbox + slider).
- Add styles for the per-root expand/collapse control.

#### Acceptance Criteria

- [ ] New toolbar controls align with existing sidebar visual language
- [ ] Toggle switch is keyboard accessible and visually clear
- [ ] Per-root expand/collapse control is visually consistent and discoverable

## Verification

1. Run `bun run lint`
2. Run `bun run fmt`
3. Run `bun run typecheck`
4. Run `bun run test`
5. Manual check:
   - Open the app and confirm PRDs are ordered descending
   - Verify only five PRDs show per root by default and expand/collapse works
   - Use open-all and close-all controls
   - Toggle incomplete-only filter and confirm sidebar and mobile selector update without changing selection
   - With a completed PRD selected, enable the filter and confirm the mobile placeholder appears; disable the filter and confirm the original selection is reflected again
