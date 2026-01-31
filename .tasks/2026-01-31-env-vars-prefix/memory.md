## B1: Rename server environment variables to PGCH\_\*

- Updated env var reads in src/server/app.ts to use PGCH_PORT, PGCH_OPEN_BROWSER, and PGCH_OPEN_DELAY_MS.
- Verified no old env var references remain in application code or user-facing strings; only .tasks planning artifacts still mention old names.
- Kept numeric parsing behavior intact by applying Number() to the final chosen port value.

## X1: Remove PGCH_DIST_ROOT and fix dist root resolution

- Removed PGCH_DIST_ROOT override handling in both src/cli.ts and bin/pgch.js, fixing distRoot to the package's dist directory.
- Node wrapper no longer injects PGCH_DIST_ROOT into the child environment; runCli no longer accepts distRoot overrides.
- Verified no PGCH_DIST_ROOT references remain in the repo.
