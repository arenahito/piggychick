# Add Test Coverage (90% Target) Implementation

## X1: Add test configuration and coverage rules

- Bun v1.3.6 accepts `coverageThreshold` with singular keys (`line/function/statement`). Using plural keys caused `bun test` to exit non-zero even when overall coverage exceeded 90%, so the singular form was kept to enforce the global threshold without per-file failures.
- `coverageDir = "./coverage"` aligns cleanly with ignoring `coverage/` in `.gitignore` so local coverage artifacts stay out of version control.

## B1: Add server/shared unit tests

- Path traversal tests against the Bun server are more reliable on Windows when using a drive-prefixed absolute path (e.g., `/C:/...`) instead of `../` segments, which may be normalized away by the URL parser.
- Git branch detection paths in `listPrds` can be exercised by creating a `.git` directory with a HEAD file or a `.git` file pointing to a missing gitdir; both are useful for covering branch and error handling logic.
- Symlink/hardlink exclusion tests should be written as best-effort because CI environments may disallow link creation; tests should skip gracefully when link operations fail.
