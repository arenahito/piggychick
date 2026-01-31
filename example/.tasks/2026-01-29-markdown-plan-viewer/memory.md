# Memory

## B1: Project Bootstrap and Tooling
- When serving dist assets from Bun, resolve real paths and ensure they stay under the dist root to avoid symlink escapes.
- Use a narrow SPA fallback: only `/index.html` falls back, other missing paths should 404 to avoid masking API routes.
- Keep a minimal content-type map for early bootstrap; expand later when serving more asset types.

## B2: .tasks Scanner and API Endpoints
- Validate PRD ids defensively: reject '.', '..', path separators, and ensure resolved paths stay under the .tasks root.
- Avoid symlink escapes by lstat checks on PRD directories and markdown files before reading.
- Keep API errors consistent with a JSON error envelope to simplify client handling.

## B3: Static Assets and Error Handling
- SPA fallback logic should handle missing files and directories consistently; serving index.html for all non-API paths matches the requirement.
- Keep content-type mapping extensible for assets like fonts, icons, and source maps to avoid browser warnings.
- Use a shared index-serving helper to avoid divergence between missing-file and directory cases.

## F1: Client Shell, Routing, and PRD Tree
- Treat hash parsing as untrusted input: decode safely and fall back when invalid or unsupported docs are requested.
- Encode PRD ids in the URL and any select values to avoid delimiter collisions.
- When memory/learning files are missing, normalize the view back to plan to keep navigation consistent.

## F2: Markdown Rendering with Mermaid Support
- DOMPurify needs explicit allowances for task-list checkboxes; otherwise the inputs can be stripped.
- Mermaid rendering should be wrapped with parse/render error handling to avoid unhandled rejections.
- GitHub markdown styles need theme-specific overrides for tables, blockquotes, and code to stay readable in dark mode.

## F3: Plan Dependency Graph View
- Use safe Mermaid node IDs (e.g., indexed tokens) instead of raw task IDs to avoid parse failures with UUIDs.
- Visualize missing dependencies with a dedicated placeholder node to surface data issues instead of silently skipping edges.
- Deduplicate dependency edges to keep graphs readable and avoid extra Mermaid work.

## F4: Theme Toggle and Themed Mermaid
- Persist theme choice to localStorage and reflect it on the html data attribute to keep UI and diagrams in sync.
- Re-render Mermaid diagrams on theme changes and restore diagram source to avoid stale SVGs.
- Preserve plan pane scroll positions when re-rendering on theme changes to avoid jarring jumps.
- Mermaid classDef does not accept CSS var() fallback syntax; use explicit hex colors per theme when generating the graph.

## D1: README
- Keep README concise: run commands, .tasks requirements, and UI behavior are the critical onboarding points.
