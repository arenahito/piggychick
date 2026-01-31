# Sidebar Root Folder and Git Branch Header Implementation

## B1: Add root/git metadata to PRD list API

Handled `.git` in three forms (directory, file, symlink) and resolved `gitdir:` relative paths against the directory containing the `.git` file to keep worktree-style layouts correct. Kept branch detection fail-open by returning `null` on read errors or detached HEAD, so listing APIs remain stable even when git metadata is unavailable.
