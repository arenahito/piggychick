## B1: Rename server environment variables to PGCH_*

- Updated env var reads in src/server/app.ts to use PGCH_PORT, PGCH_OPEN_BROWSER, and PGCH_OPEN_DELAY_MS.
- Verified no old env var references remain in application code or user-facing strings; only .tasks planning artifacts still mention old names.
- Kept numeric parsing behavior intact by applying Number() to the final chosen port value.
