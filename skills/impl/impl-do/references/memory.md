# Authentication Feature Implementation

## B1: Create User Model

### Challenge: UUID vs Auto-increment

Initially planned to use auto-increment IDs, but discovered the existing codebase uses UUIDs for all entities. Had to adjust the schema and update the migration accordingly.

### Discovery: Soft Delete Pattern

This codebase uses soft delete with `deleted_at` timestamp. All queries need `WHERE deleted_at IS NULL` or use the `withNotDeleted()` scope. This wasn't documented anywhere.

### Gotcha: Timestamp Timezone

Database stores timestamps in UTC, but the ORM returns them in local timezone. Need to explicitly call `->utc()` when comparing timestamps.

---

## B2: Add Authentication Endpoints

### Unexpected: Rate Limiting Already Exists

Discovered the API gateway already has rate limiting configured. No need to implement at application level. The limit is 100 requests/minute per IP.

### Pattern: Error Response Format

All API errors must follow the format:
```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Human readable message"
  }
}
```

### Performance: Token Validation

JWT validation was causing 50ms overhead per request. Caching the decoded token in request context reduced this to <1ms for subsequent checks within the same request.

---

## F1: Build Login Form

### Integration: Form Validation Library

The project uses `react-hook-form` with `zod` schemas. Validation schemas are shared between frontend and backend via the `@shared/schemas` package.

### Gotcha: SSR Hydration

Login form uses localStorage for "remember me" feature. This caused hydration mismatch errors. Solution: wrap localStorage access in `useEffect` and use `suppressHydrationWarning` on the checkbox.

### Discovery: Design System Tokens

Found that the design system has predefined spacing tokens (`space-xs`, `space-sm`, etc.) in `tailwind.config.js`. Should use these instead of arbitrary values for consistency.
