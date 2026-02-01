# Git worktree PRD listing Implementation

## B1: Discover worktrees and include their PRDs in list

- Detect worktree gitdirs only when the path contains a ".git/worktrees/<name>" segment to avoid false positives from unrelated directory names.
- Split gitdir paths on both separators to handle mixed slash styles from git metadata files on Windows.
- Resolve worktree gitdir paths relative to their gitdir file location and skip invalid entries to keep root PRD listing resilient.

## B2: Resolve worktree PRD IDs when reading plans/docs

- Reserve the "wt:" prefix and disallow ":" in PRD names to keep encoded IDs unambiguous across platforms.
- Decode worktree PRD IDs before filesystem access and resolve the tasks root via git worktree metadata.

## F1: Show worktree label under PRD name in sidebar

- Use a dedicated text wrapper with `flex: 1` and `min-width: 0` to keep status icons aligned while supporting multi-line labels.
- Render the worktree label as a separate muted line with ellipsis to avoid truncating the PRD title.
