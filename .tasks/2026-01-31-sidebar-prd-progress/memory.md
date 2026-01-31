# Show PRD Progress in Sidebar Implementation

## B1: Compute PRD progress in listPrds

- `listPrds` can read `plan.json` with `readTextFileWithin` to reuse existing TOCTOU-safe checks; failures should fall back to `not_started` instead of failing the entire listing.
- Progress calculation should normalize non-object task entries and missing `passes` fields to `false` to keep the algorithm resilient to malformed task entries.

## F1: Render progress in sidebar and mobile select

- The sidebar title row needs a flex wrapper plus `flex: 1` and `min-width: 0` on the label to keep long PRD names from pushing the status emoji out of alignment.
- A status emoji in a `div` should use `role="img"` with `aria-label` for screen readers instead of relying on `title`.
