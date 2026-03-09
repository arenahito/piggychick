# Implementation Subagent Instructions

## Implementation Lifecycle

You handle the complete lifecycle for your assigned task:

1. Implement the task according to `plan.md`
2. Run verification checks (see Verification below)
3. Perform self-review (see Self-Review below)
4. Launch external review as a nested subagent (see External Review below)
5. If review finds issues: fix them, re-run verification, re-do self-review, and resume the review subagent — repeat until approved
6. Record learnings in `memory.md` (see Memory Recording below)
7. Return to the orchestrator with: list of changed files, a brief implementation summary, and a proposed commit message

## Verification

Run the following verification checks after implementation:

1. **Static Analysis**
   - Run linter (eslint, ruff, golangci-lint, etc.)
   - Run type checker if applicable (tsc, mypy, etc.)

2. **Test Execution**
   - Run existing tests to detect regressions
   - Run new tests for implemented features

3. **Build Check**
   - Verify the project builds successfully

4. **Acceptance Criteria**
   - Verify all acceptance criteria defined in `plan.md` for this task are met
   - Each criterion must be explicitly checked and confirmed

**Verification Loop** (MUST complete before proceeding):

1. Run all verification checks (including acceptance criteria)
2. If ANY check fails or ANY acceptance criterion is not met:
   - Fix the issues (do NOT just report them)
   - Return to step 1 and re-run ALL checks
3. Only proceed to self-review when ALL checks pass and ALL acceptance criteria are met

**CRITICAL**: Reporting issues without fixing them is NOT acceptable. The verification loop MUST continue until all checks pass and all acceptance criteria are satisfied.

## Self-Review

After verification passes, perform self-review:

1. Review implemented code for:
   - Correctness and adherence to requirements
   - Code quality and best practices
   - Potential bugs and edge cases
   - Security concerns
   - Performance issues
2. Based on review findings, determine response based on **fix complexity** (NOT issue severity):
   - **Simple/Moderate fixes**: Fix autonomously without user confirmation
   - **Complex fixes requiring significant changes**: Report to orchestrator (see below)
3. For autonomous fixes:
   - Apply fixes directly
   - Re-run verification
   - Re-run self-review
   - Repeat until all issues are resolved
4. **Proceed to External Review ONLY when self-review passes with no issues**

**Fix Autonomously (regardless of issue severity):**

- Localized code changes within a few files
- Bug fixes and error corrections
- Code style and formatting issues
- Missing error handling
- Performance improvements within current architecture
- Documentation improvements
- Test coverage additions
- Refactoring within existing patterns

**Report to orchestrator (do NOT fix autonomously):**

- Changes requiring significant architectural restructuring
- Modifications spanning many files or modules
- Changes that fundamentally alter the implementation approach
- Trade-offs between conflicting requirements

When reporting these issues, return to the orchestrator with a description of the problem and proposed options. The orchestrator will consult the user and resume you with the decision.

## External Review

After self-review passes, launch a review subagent as a nested child. This enables direct communication between you and the reviewer without intermediary relays.

**IMPORTANT**: Resolve all self-review issues BEFORE launching external review.

**NOTE**: External review is a **code review**, not re-verification. Static analysis, tests, builds, and acceptance criteria have already been verified. The reviewer must NOT re-run these checks.

### Review Launch

1. **Launch a new review subagent** as a nested child
2. **Provide task context and role boundaries**
   - Pass the current task ID (UUID) and task prefix
   - Instruct the subagent to read the corresponding section in `plan.md` for design intent, requirements, and target files
   - Provide the list of files changed in this task
   - Instruct the subagent to read the relevant codebase (changed files and their surrounding context)
   - **Explicitly instruct**: "Your ONLY role is code review. Return your findings, then stop. Do NOT fix code, do NOT implement anything."

3. **Review scope**

   The reviewer focuses on issues that the implementer is likely to miss due to their own bias:

   **In scope:**
   - Alignment with design intent described in `plan.md`
   - Code readability and maintainability (naming, structure, separation of concerns)
   - Edge cases and error handling the implementer may have overlooked
   - Security and performance concerns (structural issues, not micro-optimizations)
   - Consistency with existing codebase conventions and patterns

   **Out of scope** (already verified):
   - Lint / static analysis results
   - Type checking
   - Test execution and results
   - Build success
   - Acceptance criteria verification

### Fix Loop

4. **If the review subagent returns issues**:
   - Fix the issues
   - Re-run verification checks
   - Perform self-review
   - **Resume the review subagent**: instruct it to re-review the codebase for the reported issues
   - Repeat until the review subagent returns approval with no issues

5. **If no issues**:
   - External review passed
   - Proceed to Memory Recording

## Memory Recording

After external review passes, record learnings in `.tasks/{YYYY-MM-DD}-{nn}-{slug}/memory.md`. You experienced the full cycle (implementation, verification, self-review, and review fix loops) and are best positioned to capture meaningful learnings.

- Capture learnings from both the implementation process and the review exchange
- Write entries to `memory.md` following the template below
- After writing, return to the orchestrator with: list of changed files, a brief implementation summary, and a proposed commit message

1. **Create or update memory.md** in the task directory
2. **Title**: Use `# {Plan Title} Implementation` as the document title (e.g., `# User Authentication Implementation`)
3. **Write in English** - memory.md is a structured data source for generating other artifacts
4. **Add a new section** for this task using the task prefix as heading (e.g., `## B1: Create User Model`)
5. **Use the entry template** for each learning (see below)

### Entry Template

Each learning MUST use the following structure:

```markdown
### <Category>: <Title>

**Context**: What situation triggered this (1-2 sentences)

**Problem**: What specifically went wrong or was unexpected

**Resolution**: How it was resolved (MUST include concrete examples: code snippets, config values, commands, error messages, etc.)

**Scope**: `codebase` | `task-specific`
```

- **`codebase`**: Applies to any development in this codebase → candidate for agent instruction files (AGENTS.md / CLAUDE.md)
- **`task-specific`**: Specific to this implementation → stays only in memory.md, valuable for future maintenance and debugging of this feature

### What to Record

Both codebase-wide and task-specific learnings:

- Technical insights specific to this codebase (`codebase`)
- Workarounds for library/framework quirks (`codebase`)
- Configuration or environment discoveries (`codebase`)
- Code patterns that worked well or didn't (`codebase`)
- Testing strategies that proved effective (`codebase`)
- Deviations from the original plan and why (`task-specific`)
- Implementation decisions and their rationale (`task-specific`)
- Integration details specific to this feature (`task-specific`)
- Edge cases encountered and how they were handled (`task-specific`)

### What NOT to Record

- Generic programming knowledge (not specific to this codebase)
- Information already documented elsewhere (README, docs, etc.)

See [memory.md](references/memory.md) for example format.

## Important Rules

- **Own the full cycle** - Handle implementation, verification, self-review, external review (as a nested subagent), and memory recording — then return results to the orchestrator
- **Reuse review subagents within a task** - When fix→re-review loops occur, resume the same review subagent to preserve review context
- **Fix review findings autonomously** based on fix complexity
- **Report to orchestrator** when fixes require significant architectural changes; do NOT fix autonomously
- **Save temporary files under the plan directory** - Any temporary files created during investigation or implementation (e.g., debug logs, analysis outputs, scratch notes) must be saved under `.tasks/{YYYY-MM-DD}-{nn}-{slug}/tmp/`. Do NOT save them in the project root or other locations. Clean up when no longer needed.
