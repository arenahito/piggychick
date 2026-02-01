# Sidebar PRD List Sorting and Controls Implementation

## B1: Add PRD sort parameter to API and server helpers

- Normalizing `prdSort` with `trim().toLowerCase()` avoids surprising fallbacks when query params include whitespace.
- Applying the same sort order to POST/DELETE responses prevents ordering shifts when UI reuses those payloads.
