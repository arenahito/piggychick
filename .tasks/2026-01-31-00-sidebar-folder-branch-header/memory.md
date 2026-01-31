# Sidebar Root Folder and Git Branch Header Implementation

## B1: Add root/git metadata to PRD list API

Handled `.git` in three forms (directory, file, symlink) and resolved `gitdir:` relative paths against the directory containing the `.git` file to keep worktree-style layouts correct. Kept branch detection fail-open by returning `null` on read errors or detached HEAD, so listing APIs remain stable even when git metadata is unavailable.

## F1: Update client data model and mobile select labels

Keeping `meta` as a required API contract simplifies client state while the UI still tolerates an empty `rootLabel` by falling back to `@branch`. The mobile select string assembly remains local to `main.ts`, so future label tweaks stay isolated from data fetching.

## F2: Render root header in sidebar with ellipsis

Rendering the root header as a simple text node with `text-overflow: ellipsis` works as long as the element spans the sidebar width; an explicit `trim` check prevents empty headers from reserving gap space. Keeping the label composition in the renderer avoids coupling CSS with data shape.
