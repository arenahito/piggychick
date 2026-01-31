# Implementation Plan: Environment Variable Prefixing and Dist Root Fix

## Overview

Standardize app-specific environment variables to the PGCH_ prefix, replace the generic PORT with PGCH_PORT, and remove the PGCH_DIST_ROOT override so the dist root is always the packaged dist directory.

## Goal

PiggyChick uses only PGCH_* environment variables for app-specific settings and always serves from the fixed dist path under the package root.

## Scope

- Included:
  - Rename server environment variables to PGCH_PORT, PGCH_OPEN_BROWSER, and PGCH_OPEN_DELAY_MS.
  - Remove PGCH_DIST_ROOT handling and use a fixed dist root derived from the package root.
  - Update both Bun and Node entry paths to match the new behavior.
  - Update any in-repo references to old env var names if found during search (code, scripts, docs).
- Excluded:
  - Backwards compatibility for old environment variables.
  - External documentation or release notes outside this repository.
  - Any functional changes unrelated to environment variables.

## Prerequisites

- Understanding of current startup flow in `src/cli.ts`, `bin/pgch.js`, and `src/server/app.ts`.
- Ability to run `bun run dev` or execute the CLI for manual verification.

## Design

### Environment Variable Mapping

- `PORT` -> `PGCH_PORT`
- `OPEN_BROWSER` -> `PGCH_OPEN_BROWSER`
- `OPEN_DELAY_MS` -> `PGCH_OPEN_DELAY_MS`
- `PGCH_DIST_ROOT` -> removed (fixed to `{packageRoot}/dist`)

### Precedence and Defaults

- `port = Number(options.port ?? process.env.PGCH_PORT ?? 3000)` (Number applied to the final chosen value, same as today)
- `PGCH_OPEN_BROWSER === "0"` disables auto-open; any other value keeps current behavior.
- `PGCH_OPEN_DELAY_MS` is parsed with `Number(...)`; non-finite values skip the delay (same as current behavior).

### Invalid Value Handling (Explicit)

- `PGCH_PORT` (or `options.port` if provided as a string): if non-numeric, `Number(...)` yields `NaN` and is passed through as-is (same as current behavior with `PORT`).
- `PGCH_OPEN_DELAY_MS`: if `NaN` or `<= 0`, the delay is skipped (same as current behavior).

### Startup Flow

```mermaid
flowchart TD
  A[CLI or bin/pgch.js] --> B[Resolve distRoot = {packageRoot}/dist]
  B --> C[Resolve tasksRoot from argv or CWD]
  C --> D[startServer]
  D --> E[Read PGCH_PORT / PGCH_OPEN_BROWSER / PGCH_OPEN_DELAY_MS]
  E --> F[Bun.serve on selected port]
```

## Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Dist root override | Remove PGCH_DIST_ROOT and always use `{packageRoot}/dist` | User confirmed fixed path is acceptable |
| Env var prefix | Use PGCH_ prefix for app-specific variables | Avoid collisions and standardize naming |
| Port variable | Replace PORT with PGCH_PORT | Avoid conflicts with other apps |
| Backward compatibility | Do not support old names | User explicitly requested no compatibility |

## Risks and Mitigations

- Risk: Existing users with old env vars will see behavior changes with no fallback. Mitigation: ensure all in-repo references are updated and keep error messages accurate; external comms are out of scope by request.

## Tasks

### B1: Rename server environment variables to PGCH_* 

- **ID**: `59e674bd-cddd-4724-94ea-4851044aba92`
- **Category**: `backend`
- **File(s)**: `src/server/app.ts`

#### Description

Update server startup configuration to read PGCH-prefixed environment variables for port, browser auto-open, and open delay. Remove all references to PORT, OPEN_BROWSER, and OPEN_DELAY_MS.

#### Details

- Replace `process.env.PORT` with `process.env.PGCH_PORT` in the port selection logic.
- Replace `process.env.OPEN_BROWSER` with `process.env.PGCH_OPEN_BROWSER`.
- Replace `process.env.OPEN_DELAY_MS` with `process.env.PGCH_OPEN_DELAY_MS`.
- Keep existing behavior for numeric parsing and default values to avoid unrelated changes.
- Run `rg -n "process\.env\.(PORT|OPEN_BROWSER|OPEN_DELAY_MS)"` to confirm no old names remain.
- Run `rg -n "process\.env\.PORT|\$env:PORT|\bPORT=|OPEN_BROWSER|OPEN_DELAY_MS"` and update any in-repo text (README/help/scripts) that mentions old env var names.
- Review user-facing error/help strings in `src/cli.ts` and `bin/pgch.js`; if any mention old env var names, update them to PGCH_*.

#### Acceptance Criteria

- [ ] `src/server/app.ts` reads only PGCH_* environment variables.
- [ ] Port selection still honors `options.port` and defaults to 3000 when unset.
- [ ] Auto-open behavior and delay match existing semantics except for the variable names.
- [ ] `rg -n "process\.env\.(PORT|OPEN_BROWSER|OPEN_DELAY_MS)"` returns no matches.
- [ ] `rg -n "process\.env\.PORT|\$env:PORT|\bPORT=|OPEN_BROWSER|OPEN_DELAY_MS"` finds no references to the old env var names in repo text.
- [ ] No user-facing error/help strings mention the old env var names.

### X1: Remove PGCH_DIST_ROOT and fix dist root resolution

- **ID**: `fe936267-608f-407c-b160-7a68b274fd5f`
- **Category**: `other`
- **File(s)**: `src/cli.ts`, `bin/pgch.js`

#### Description

Eliminate the PGCH_DIST_ROOT override path and always resolve distRoot from the package root. Ensure both Bun and Node entrypoints follow the same fixed path and no longer pass or read PGCH_DIST_ROOT.

#### Details

- In `src/cli.ts`, remove env-based dist root logic and resolve `distRoot` from `resolvePackageRoot()`.
- In `bin/pgch.js`, remove `process.env.PGCH_DIST_ROOT` handling and any injected env overrides.
- Ensure `ensureDistRoot`/`assertDistRoot` continue to validate the fixed dist path.
- Keep tasksRoot resolution behavior unchanged.
- Run `rg -n "PGCH_DIST_ROOT"` to confirm no references remain.

#### Acceptance Criteria

- [ ] `PGCH_DIST_ROOT` is no longer referenced anywhere in the codebase.
- [ ] CLI always uses `{packageRoot}/dist` as the dist root.
- [ ] Node wrapper no longer injects PGCH_DIST_ROOT into child env.

## Verification

- **Automated tests**: `bun run lint`
- **Manual testing steps**:
  1. POSIX: `PGCH_OPEN_BROWSER=0 PGCH_PORT=4010 bun run dev` and confirm server starts on port 4010 without opening a browser.
  2. PowerShell: `$env:PGCH_OPEN_BROWSER="0"; $env:PGCH_PORT="4010"; bun run dev` and confirm the same.
  3. POSIX: `PGCH_OPEN_DELAY_MS=2000 bun run dev` and confirm the browser opens after ~2 seconds.
  4. PowerShell: `$env:PGCH_OPEN_DELAY_MS="2000"; bun run dev` and confirm the same.
  5. Run the CLI with and without a tasks path to ensure `.tasks` is still resolved correctly.
  6. PowerShell: `$env:PGCH_OPEN_BROWSER="0"; $env:PGCH_PORT="4020"; node .\\bin\\pgch.js` and confirm the Node wrapper starts the server on port 4020.
- **Demo scenario**: Start the server with PGCH-prefixed variables and verify the UI loads from the packaged `dist` directory.
