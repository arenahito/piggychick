# Show PRD Folder Path in Markdown Preview Implementation

## B1: Return PRD path from plan API

- `readPlan` already resolves PRD directories via `resolvePrdDir`, which returns a real path; using that value for `prdPath` keeps worktree paths accurate but reflects the normalized filesystem path.
- The plan payload can be safely extended with additional fields without breaking existing tests; extra fields are tolerated by current consumers.

## F1: Render PRD path header with copy action

- The plan view can insert a header above the doc nav by creating the nav and then placing it after the header when present.
- Copy feedback can rely on `data-state` styling and a `role="status"` live region while keeping the button label stable for clarity.

## F2: Style PRD path header and copy button

- The path header looks most stable when it shares the markdown max width and uses muted-strong monospace text for readability.
- Copy button feedback should not be overridden by hover styles; keep hover styling limited to non-success/error states.
