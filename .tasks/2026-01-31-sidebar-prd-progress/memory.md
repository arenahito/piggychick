# Show PRD Progress in Sidebar Implementation

## B1: Compute PRD progress in listPrds

- `listPrds` can read `plan.json` with `readTextFileWithin` to reuse existing TOCTOU-safe checks; failures should fall back to `not_started` instead of failing the entire listing.
- Progress calculation should normalize non-object task entries and missing `passes` fields to `false` to keep the algorithm resilient to malformed task entries.
