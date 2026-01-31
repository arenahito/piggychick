# Implementation Plan: Show PRD Progress in Sidebar

## Overview

Add a progress indicator next to each PRD name in the left sidebar and in the mobile select. Progress is derived from each PRD's `plan.json` task `passes` values and rendered as emojis.

## Goal

Users can see each PRD's progress status (not started, in progress, done) as an emoji aligned to the right of the PRD name in the sidebar and also in the mobile select list.

## Scope

- Included: server-side progress computation from `plan.json`, API payload extension, sidebar + mobile select rendering, CSS for right-aligned status block
- Excluded: changes to `plan.json` schema, plan graph rendering, or task editing UI

## Prerequisites

- Existing `.tasks/{prd}/plan.json` uses `tasks[].passes` booleans
- `/api/prds` already lists PRDs with `id`, `label`, and `docs`

## Design

### Data Flow

```mermaid
flowchart LR
  A[.tasks/{prd}/plan.json] -->|readTextFileWithin| B[listPrds]
  B --> C[computeProgress]
  C --> D[/api/prds payload: progress]
  D --> E[client state]
  E --> F[sidebar + mobile select emoji]
```

### Progress Algorithm

- Read `plan.json` safely; on read failure, parse failure, or invalid shape, treat as not started.
- Evaluate `tasks[].passes` as booleans:
  - all `false` => not started
  - all `true` => done
  - mixed => in progress
- If `tasks` is missing or empty, treat as not started.
- If a task entry is not an object or is missing a boolean `passes`, treat it as `false`.

### API Contract

Extend `PrdSummary` to include a `progress` field:

```ts
export type PrdProgress = "not_started" | "in_progress" | "done";
export type PrdSummary = {
  id: string;
  label: string;
  docs: string[];
  progress: PrdProgress;
};
```

### UI/UX Design

- Sidebar PRD title row becomes a flex row with two blocks:
  - Left: PRD label (existing styling)
  - Right: status emoji block, right-aligned
- Mobile select options keep the existing `{PRD} / {doc}` format and insert the emoji after the PRD label: `{PRD} {emoji} / {doc}`.
- Emoji mapping uses codepoints to avoid copy/paste issues:
  - not started: U+2B1C (use `String.fromCodePoint(0x2b1c)`)
  - in progress: U+1F504 (use `String.fromCodePoint(0x1f504)`)
  - done: U+2705 (use `String.fromCodePoint(0x2705)`)
- Keep existing dark theme, spacing scale, and typography.
- Add `aria-label` on the sidebar status element for accessibility (English labels). Do not rely on `title` for `<option>` elements; the option text is the accessible label for mobile select.

## Decisions

| Topic | Decision | Rationale |
| --- | --- | --- |
| Progress computation | Server-side in `listPrds` | Avoid extra per-PRD requests from the client |
| Invalid `plan.json` | Treat as not started | Matches requirement and avoids UI errors |
| Mobile select display | Include same emoji | User requested both sidebar and mobile |
| Emoji rendering | Use Unicode codepoints | Avoid paste issues for U+1F504 |
| Client fallback | Default missing `progress` to `not_started` | Allows safe rollout order (server first, client second) |

## Risks

- Listing many PRDs increases I/O due to reading `plan.json` during `/api/prds`; if this becomes slow, consider caching in a later iteration (out of scope here).

## Tasks

### B1: Compute PRD progress in `listPrds`

- **ID**: `c07f261b-449d-4b03-b06c-b09738f7594d`
- **Category**: `backend`
- **File(s)**: `src/server/tasks.ts`

#### Description

Parse each PRD's `plan.json` while listing PRDs and compute a progress status. Extend the server-side `PrdSummary` type to include this status so the API can return it in `/api/prds`.

#### Details

- Add `PrdProgress` union type and a `progress` field on `PrdSummary`.
- Read `plan.json` for each PRD using `readTextFileWithin` to keep existing safety checks.
- Implement `computeProgress(planJsonText: string): PrdProgress`:
  - `try/catch` JSON parse; on read or parse error return `not_started`.
  - If `tasks` is not an array or is empty, return `not_started`.
  - Coerce `passes` to boolean with `task?.passes === true` and treat non-object entries as `false`.
  - Determine `allTrue` and `allFalse` from the normalized list.
  - Return `done` if `allTrue`, `not_started` if `allFalse`, otherwise `in_progress`.
- Ensure `listPrds` still only includes PRDs with both `plan.md` and `plan.json` present.

#### Acceptance Criteria

- [ ] `/api/prds` includes `progress` for every PRD
- [ ] Invalid or unreadable `plan.json` yields `progress = "not_started"`
- [ ] Progress matches the all-false / all-true / mixed rules

### F1: Render progress in sidebar and mobile select

- **ID**: `9bb1459b-a0c3-41d5-8796-e5d69fc1263c`
- **Category**: `frontend`
- **File(s)**: `src/client/api.ts`, `src/client/components/sidebar.ts`, `src/client/main.ts`, `src/client/styles.css`

#### Description

Consume the new `progress` field and render an emoji status next to each PRD name in the sidebar and in the mobile select options.

#### Details

- Update client-side `PrdSummary` type to include `progress`.
- Add a shared helper to map `progress` to an emoji using codepoints.
- Default missing `progress` to `not_started` before mapping to emoji.
- Sidebar:
  - Replace the PRD title text node with a wrapper row containing label + status.
  - Status element is a separate block aligned to the right.
  - Add `aria-label` ("Not started", "In progress", "Done") for accessibility.
- Mobile select:
  - Update option label to include the same emoji after the PRD label, keeping the existing `{PRD} / {doc}` format.
- CSS:
  - Add a `.sidebar-group-title-row` flex container with `justify-content: space-between`.
  - Add `.sidebar-group-title-status` with `text-align: right` and muted color.

#### Acceptance Criteria

- [ ] Sidebar shows right-aligned emoji per PRD name
- [ ] Mobile select options include the same emoji per PRD
- [ ] Emoji mapping uses codepoints (no paste dependency for U+1F504)
- [ ] Layout remains stable and matches existing theme
- [ ] UI does not break if `progress` is missing; it falls back to `not_started`

## Verification

- Automated: `bun run lint`
- Manual:
  1. Start the app with `bun run dev`.
  2. Open the UI and confirm each PRD shows a status emoji in the sidebar title row.
  3. Open the mobile select and confirm each option includes the same emoji.
  4. Edit a `plan.json` to all `passes: false` -> status shows not started.
  5. Mix `passes: true/false` -> status shows in progress.
  6. Set all `passes: true` -> status shows done.
  7. Break `plan.json` JSON and confirm status falls back to not started.
