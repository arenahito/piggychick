# Sidebar Root Header Collapse and Emphasis Implementation

## F1: Add sidebar collapse state and toggle behavior

- Added a localStorage-backed `sidebarCollapsed` state with try/catch guards so the UI still toggles if storage is unavailable.
- Rendered the root header as a button and drove `aria-expanded`/labels from the collapse state to keep accessibility consistent.
- Introduced `shouldCollapse` to avoid collapsing the sidebar when `rootMeta` is missing, preventing a blank sidebar.
- Added a fallback header label ("PRDs") so the collapse toggle remains available even if the computed label is empty.
