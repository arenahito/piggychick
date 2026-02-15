# Authentication Feature Implementation

## B1: Create User Model

### Challenge: UUID vs Auto-increment

**Context**: Initially planned to use auto-increment IDs for the user model primary key.

**Problem**: The existing codebase uses UUIDs for all entities. Auto-increment IDs would break foreign key conventions and cause inconsistency with existing queries that expect UUID format.

**Resolution**: Adjusted the schema to use UUID primary keys and updated the migration accordingly.
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);
```

**Scope**: `codebase`

### Discovery: Soft Delete Pattern

**Context**: Attempted to add a standard DELETE endpoint for users.

**Problem**: Existing queries across the codebase assume soft delete. A hard delete broke cascading relationships and audit trails.

**Resolution**: All models use soft delete with `deleted_at` timestamp. All queries need `WHERE deleted_at IS NULL` or use the `withNotDeleted()` scope. This wasn't documented anywhere.
```typescript
// Correct query pattern
const user = await User.query().withNotDeleted().findById(id);
// NOT: await User.query().findById(id);
```

**Scope**: `codebase`

### Gotcha: Timestamp Timezone

**Context**: Writing tests that compare created_at values against expected timestamps.

**Problem**: Database stores timestamps in UTC, but the ORM returns them in local timezone. Assertion failures occurred because `2024-01-01T00:00:00Z` was returned as `2024-01-01T09:00:00+09:00`.

**Resolution**: Explicitly call `->utc()` when comparing timestamps.
```typescript
expect(user.createdAt.utc().toISO()).toBe(expected.utc().toISO());
```

**Scope**: `codebase`

---

## B2: Add Authentication Endpoints

### Unexpected: Rate Limiting Already Exists

**Context**: Implementing rate limiting for the login endpoint to prevent brute-force attacks.

**Problem**: Added application-level rate limiting, which caused double rate limiting — requests were rejected far earlier than expected.

**Resolution**: The API gateway already has rate limiting configured (100 requests/minute per IP). Removed application-level implementation and documented the gateway config location.

**Scope**: `task-specific`

### Pattern: Error Response Format

**Context**: Returning error responses from the auth endpoints.

**Problem**: Initial implementation used ad-hoc error formats. API integration tests from other teams failed because they expected the standard error format.

**Resolution**: All API errors must follow the established format:
```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Human readable message"
  }
}
```
Use the `ApiError` class from `@shared/errors` to ensure consistency.

**Scope**: `codebase`

### Performance: Token Validation

**Context**: Load testing the authenticated endpoints.

**Problem**: JWT validation was causing 50ms overhead per request. Under load, this accumulated to unacceptable response times.

**Resolution**: Caching the decoded token in request context reduced validation to <1ms for subsequent checks within the same request.
```typescript
req.context.decodedToken ??= await verifyJwt(req.headers.authorization);
```

**Scope**: `task-specific`

---

## F1: Build Login Form

### Integration: Form Validation Library

**Context**: Building the login form with client-side validation.

**Problem**: Initially wrote custom validation logic, which diverged from backend validation rules and caused inconsistent error messages.

**Resolution**: The project uses `react-hook-form` with `zod` schemas. Validation schemas are shared between frontend and backend via the `@shared/schemas` package.
```typescript
import { loginSchema } from '@shared/schemas';
const form = useForm({ resolver: zodResolver(loginSchema) });
```

**Scope**: `codebase`

### Gotcha: SSR Hydration

**Context**: Implementing "remember me" checkbox that persists user preference.

**Problem**: Login form reads localStorage on initial render for the "remember me" state. This caused hydration mismatch errors because the server render had no access to localStorage.

**Resolution**: Wrap localStorage access in `useEffect` and use `suppressHydrationWarning` on the checkbox.
```tsx
const [rememberMe, setRememberMe] = useState(false);
useEffect(() => {
  setRememberMe(localStorage.getItem('rememberMe') === 'true');
}, []);
<input type="checkbox" suppressHydrationWarning checked={rememberMe} />
```

**Scope**: `task-specific`

### Discovery: Design System Tokens

**Context**: Styling the login form layout with custom spacing values.

**Problem**: Code review flagged inconsistent spacing — used `p-3` and `p-5` instead of design system tokens, which made the UI subtly inconsistent with other pages.

**Resolution**: The design system has predefined spacing tokens (`space-xs`, `space-sm`, etc.) in `tailwind.config.js`. Must use these instead of arbitrary values.
```tsx
// Correct
<div className="p-space-sm gap-space-xs">
// Incorrect
<div className="p-3 gap-2">
```

**Scope**: `codebase`
