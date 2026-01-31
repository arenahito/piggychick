# Add Test Coverage (90% Target) Implementation

## X1: Add test configuration and coverage rules

- Bun v1.3.6 accepts `coverageThreshold` with singular keys (`line/function/statement`). Using plural keys caused `bun test` to exit non-zero even when overall coverage exceeded 90%, so the singular form was kept to enforce the global threshold without per-file failures.
- `coverageDir = "./coverage"` aligns cleanly with ignoring `coverage/` in `.gitignore` so local coverage artifacts stay out of version control.
