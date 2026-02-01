# Sidebar PRD List Sorting and Controls Implementation

## B1: Add PRD sort parameter to API and server helpers

- Normalizing `prdSort` with `trim().toLowerCase()` avoids surprising fallbacks when query params include whitespace.
- Applying the same sort order to POST/DELETE responses prevents ordering shifts when UI reuses those payloads.

## F1: Request descending PRD order from the client API

- `fetchRoots` is the single place to apply the `prdSort=desc` query parameter; tests should stub against the full URL with the query string.
