# Git worktree PRD listing Implementation

## B1: Discover worktrees and include their PRDs in list

- Detect worktree gitdirs only when the path contains a ".git/worktrees/<name>" segment to avoid false positives from unrelated directory names.
- Split gitdir paths on both separators to handle mixed slash styles from git metadata files on Windows.
- Resolve worktree gitdir paths relative to their gitdir file location and skip invalid entries to keep root PRD listing resilient.

## B2: Resolve worktree PRD IDs when reading plans/docs

- Reserve the "wt:" prefix and disallow ":" in PRD names to keep encoded IDs unambiguous across platforms.
- Decode worktree PRD IDs before filesystem access and resolve the tasks root via git worktree metadata.
