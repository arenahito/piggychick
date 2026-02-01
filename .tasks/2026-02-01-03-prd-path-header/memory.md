# Show PRD Folder Path in Markdown Preview Implementation

## B1: Return PRD path from plan API

- `readPlan` already resolves PRD directories via `resolvePrdDir`, which returns a real path; using that value for `prdPath` keeps worktree paths accurate but reflects the normalized filesystem path.
- The plan payload can be safely extended with additional fields without breaking existing tests; extra fields are tolerated by current consumers.
