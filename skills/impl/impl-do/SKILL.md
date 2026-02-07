---
name: impl-do
description: |
  Workflow for executing implementation tasks.
  Use this skill when you need to:
  (1) Execute a prepared implementation plan
  (2) Implement tasks sequentially based on dependency resolution
  (3) For each task: implement → verify → self-review → external review
  This skill enforces: (a) dependency-based task execution, (b) per-task review cycle.
metadata:
  short-description: Execute implementation plans with per-task review cycle
---

# Implementation Workflow

## Core Principles

1. **Execute tasks by dependency** - Pick any task with no unresolved dependencies and execute it
2. **Complete each task fully** - Implementation → Verification → Self-review → External review as one unit per task
3. **Complete all tasks without stopping** - NEVER stop mid-workflow; continue until all tasks are finished

## Reference

This workflow uses files from the `.tasks/{YYYY-MM-DD}-{nn}-{slug}/` directory created by impl-plan:

- **plan.md** - Human-readable plan with task descriptions, file paths, and acceptance criteria
- **plan.json** - Machine-readable task list for tracking progress
- **memory.md** - Learnings recorded during task execution (created by this workflow)

See [plan-json-schema.md](../impl-plan/references/plan-json-schema.md) for:
- Schema definition of `plan.json`
- yq commands to query next executable task and mark tasks complete

## Documentation Language

All documents under `.tasks/` must be written in **English**.

## Workflow

### Phase 1: Task Planning

Load the implementation plan and register tasks as todos:

1. Load the implementation plan from `plan.json`
2. Register all tasks as todos (all start as "pending")
3. Ensure review is included after implementation phase

#### Loading the Plan

Read `plan.json` from the `.tasks/{YYYY-MM-DD}-{nn}-{slug}/` directory.

#### Register Todos

Register and track todos from the `tasks` array using your environment's task management mechanism (e.g., todo tool, task list, or equivalent):

- **1 task = 1 todo** (strict 1:1 mapping)
- **DO NOT combine multiple tasks into a single todo**
- Use task prefix as todo ID (e.g., `B1`, `F2`)
- Use task title as todo content (e.g., `B1: Create User Model`)
- If `status = "done"`, register as "completed" (for resuming interrupted work)
- If `status = "in_progress"`, reset to `"pending"` in `plan.json` and register as "pending" (previous execution was interrupted; re-execute from scratch)
- If `status = "pending"`, register as "pending"
- Update todo status as each task completes

**Example** - If `plan.json` has 3 tasks (B1, B2, F1), create exactly 3 todos:

```
Todo 1: id="B1", content="B1: Create User Model"
Todo 2: id="B2", content="B2: Add API endpoints"
Todo 3: id="F1", content="F1: Build login form"
```

**WRONG**: Creating a single todo like "Implement B1, B2, and F1" that combines multiple tasks

### Phase 2: Task Execution

Execute tasks based on dependency resolution. For each task, perform implementation, self-review, and external review as a single unit.

**Task Execution Loop**:

1. **Get next task**: Find the next executable task from `plan.json`
   - Task has `status = "pending"`
   - All tasks in `dependsOn` have `status = "done"` (or `dependsOn` is empty)
2. **Mark task as in progress**: Set `status: "in_progress"` in `plan.json`
3. **Read task details**: Get task details from `plan.md` (description, file paths, acceptance criteria, etc.)
4. **Implement**: Execute the task implementation
5. **Verify**: Run verification checks (see Verification below)
6. **Self-review**: Review and fix issues (see Self-Review below)
7. **External review**: Request external review via subagent (see External Review below)
8. **Complete task**:
   - Mark task as complete in `plan.json` (set `status: "done"`)
   - Record learnings in memory.md (see Memory Recording below)
   - Git commit all changes (see Git Commit below)
   - Update todo status
8. **Repeat**: Go to step 1 until all tasks are complete

#### Verification

After implementing each task, run verification checks:

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

#### Self-Review

After verification passes, **perform self-review**:

1. Review implemented code for:
   - Correctness and adherence to requirements
   - Code quality and best practices
   - Potential bugs and edge cases
   - Security concerns
   - Performance issues
2. Based on review findings, determine response based on **fix complexity** (NOT issue severity):
   - **Simple/Moderate fixes**: Fix autonomously without user confirmation
   - **Complex fixes requiring significant changes**: Consult user before proceeding
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

**Require User Confirmation:**

- Changes requiring significant architectural restructuring
- Modifications spanning many files or modules
- Changes that fundamentally alter the implementation approach
- Trade-offs between conflicting requirements

#### External Review

After self-review passes, **perform external review using a subagent**:

**IMPORTANT**: External review is high-cost. Resolve all self-review issues BEFORE requesting external review.

1. **Launch or resume review subagent**
   - If no review subagent exists yet, launch one and store the agent ID in session memory
   - If a review subagent already exists (from previous tasks), resume it using the stored agent ID
   - The same subagent is reused across ALL tasks in the workflow

2. **Process review findings**
   - Identify all issues and suggestions from subagent response

3. **If issues exist**:
   - Fix all identified issues
   - Re-run verification
   - Perform self-review again
   - **Resume the same subagent** using the stored agent ID
   - Repeat until external review passes

4. **If no issues**:
   - External review passed
   - Mark task as complete and proceed to next task
   - Do NOT terminate the subagent (it will be reused for the next task)

#### Memory Recording

After external review passes, record learnings from this task in `.tasks/{YYYY-MM-DD}-{nn}-{slug}/memory.md`:

1. **Create or update memory.md** in the task directory
2. **Title**: Use `# {Plan Title} Implementation` as the document title (e.g., `# User Authentication Implementation`)
3. **Write in English** - memory.md is a structured data source for generating other artifacts
4. **Add a new section** for this task using the task prefix as heading (e.g., `## B1: Create User Model`)
5. **Record learnings** that emerged during implementation:
   - Unexpected challenges and how they were resolved
   - Useful techniques or patterns discovered
   - Gotchas, edge cases, or non-obvious behaviors
   - Performance considerations or optimizations
   - Integration points that required special attention
   - Any deviations from the original plan and why

**What to Record:**

- Technical insights specific to this codebase
- Workarounds for library/framework quirks
- Configuration or environment discoveries
- Code patterns that worked well (or didn't)
- Testing strategies that proved effective

**What NOT to Record:**

- Generic programming knowledge
- Information already documented elsewhere
- Task-specific details with no reuse value

See [memory.md](references/memory.md) for example format.

#### Git Commit

After recording learnings, commit all changes for this task:

1. **Check for commit message rules**
   - Look for project-specific commit conventions (e.g., `.gitmessage`, `CONTRIBUTING.md`, or repository rules)
   - If rules exist, follow them

2. **Default to Conventional Commits**
   - If no project-specific rules exist, use [Conventional Commits](https://www.conventionalcommits.org/) format:
     ```
     <type>(<scope>): <description>
     ```
   - Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
   - Scope: affected module (e.g., `auth`, `api`, `database`)
   - Example: `feat(auth): add user authentication endpoint`

3. **Stage and commit**
   - Stage all changes (if `plan.json` is not gitignored, include it as well)
   - Create commit with appropriate message
   - Do NOT push (user will decide when to push)

**Note**: If `plan.json` is not gitignored, including it in the commit ensures consistency when resuming interrupted work. If it is gitignored, it will be automatically excluded and the commit will proceed normally.

### Phase 3: Completion

Before reporting completion to user:

1. Verify all tasks in `plan.json` have `status = "done"`
2. Verify all todos are marked as completed
3. If any task is incomplete, return to Phase 2 and complete remaining tasks
4. **Terminate review subagent**: If a review subagent was used and a terminate function is available, terminate it by specifying the stored agent ID. If termination is not supported, do nothing.
5. Update AGENTS.md with learnings (see below)
6. Git commit the AGENTS.md updates (use commit message: `docs: update AGENTS.md with learnings from {slug}`)
7. Provide summary of completed work

#### Update AGENTS.md

Integrate universally applicable learnings from `memory.md` into AGENTS.md:

1. **Find all AGENTS.md files** in the repository:
   - AGENTS.md can exist at repository root AND in subdirectories
   - Each AGENTS.md applies to its directory and descendants
   - Example locations: `./AGENTS.md`, `./backend/AGENTS.md`, `./frontend/AGENTS.md`

2. **Read and understand existing AGENTS.md structure**:
   - Read the entire AGENTS.md file before making changes
   - Identify existing sections and their purposes
   - Understand the organizational pattern used in the file

3. **Match learnings to appropriate AGENTS.md**:
   - Review each learning in `memory.md`
   - Determine which directory scope the learning applies to
   - Update the AGENTS.md file closest to the relevant code
   - Example: Backend database learnings → `./backend/AGENTS.md` (if exists) or `./AGENTS.md`

4. **If no AGENTS.md exists anywhere**, create one at repository root

5. **Filter learnings** - Only include information that:
   - Applies to ANY development in the target scope (not just this PRD)
   - Represents codebase conventions or patterns
   - Documents non-obvious behaviors that all developers should know
   - Describes integration patterns with external services
   - Captures environment or configuration requirements

6. **Integrate into existing structure** (DO NOT create a "Learnings" section):
   - Find the most appropriate existing section for each learning
   - If a section for that topic exists, add to it or update existing content
   - If no suitable section exists, create a descriptive section name that matches the topic (e.g., "Database Patterns", "API Conventions", "Testing Guidelines")
   - Merge related information rather than duplicating
   - Keep entries concise and actionable
   - Focus on "what every developer should know"

**Include in AGENTS.md:**

- Codebase-specific conventions discovered
- Non-obvious configuration requirements
- Integration patterns with external systems
- Common pitfalls and how to avoid them
- Testing patterns specific to this codebase

**Do NOT include in AGENTS.md:**

- Task-specific implementation details
- Temporary workarounds
- Information already documented in README or other docs
- Generic best practices (not codebase-specific)
- A generic "Learnings" or "Learning" section (integrate into topic-specific sections instead)

## Important Rules

- **NEVER stop mid-workflow** - Complete ALL tasks from start to finish without interruption
- **Execute tasks by dependency** - Pick any task where all dependencies are complete; no strict execution order
- **Complete each task fully before moving to next** - Implementation → Verification → Self-review → External review → Memory → Commit → Mark complete
- **Run verification after implementation** - Execute lint, tests, and build checks; fix all issues before self-review
- **Resolve ALL self-review issues before external review** - External review is high-cost; do not waste it on issues you can find yourself
- **Use single subagent for external review** - Reuse the same review subagent across ALL tasks in the workflow
- **Keep subagent ID in session memory** - Store the agent ID to resume the same subagent for all external reviews throughout the workflow
- **Record learnings in memory.md** - After each task, document discoveries, gotchas, and patterns in memory.md
- **Update appropriate AGENTS.md** - AGENTS.md can exist in root and subdirectories; match learnings to the closest relevant file
- **Create AGENTS.md if none exists** - If no AGENTS.md exists in the repository, create one at root with universal learnings
- Fix review findings autonomously based on fix complexity - do NOT ask user permission for simple/moderate fixes
- Only consult user when fixes require significant architectural changes or widespread modifications
