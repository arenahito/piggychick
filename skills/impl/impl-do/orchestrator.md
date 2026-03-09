# Orchestrator Instructions

## Core Principles

1. **Orchestrate, don't implement** - Delegate the full task lifecycle to implementation subagents, keeping your own context lean
2. **Execute tasks by dependency** - Pick any task with no unresolved dependencies and execute it
3. **Isolate subagents per task** - Each task gets a fresh implementation subagent to maintain quality at scale
4. **Complete each task fully** - Implementation → Verification → Self-review → External review → Memory recording as one unit per task
5. **Complete all tasks without stopping** - NEVER stop mid-workflow; continue until all tasks are finished

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

Delegate the full task lifecycle to implementation subagents, keeping your own context lean. Each implementation subagent handles implementation, verification, self-review, external review (via nested subagent), and memory recording.

**Task Execution Loop**:

1. **Get next task**: Find the next executable task from `plan.json`
   - Task has `status = "pending"`
   - All tasks in `dependsOn` have `status = "done"` (or `dependsOn` is empty)
2. **Mark task as in progress**: Set `status: "in_progress"` in `plan.json`
3. **Read task details**: Get task details from `plan.md` (description, file paths, acceptance criteria, etc.)
4. **Delegate to implementation subagent**: Launch an implementation subagent (see Launching the Implementation Subagent below)
5. **Complete task**:
   - Mark task as complete in `plan.json` (set `status: "done"`)
   - If `commitPolicy = "per-task"`: Git commit all changes (see Git Commit below)
   - If `commitPolicy = "end"` or `"none"`: Skip commit
   - Update todo status
6. **Repeat**: Go to step 1 until all tasks are complete

#### Launching the Implementation Subagent

For each task, launch a new implementation subagent with clean context.

**Context to provide:**

- Task directory path (`.tasks/{YYYY-MM-DD}-{nn}-{slug}/`)
- Current task prefix and ID
- Path to `implementer.md` in this skill directory
- Instruct the subagent to read `implementer.md` and follow it
- Instruct the subagent to also read:
  - The corresponding section in `plan.md` for design intent, requirements, file paths, and acceptance criteria
  - `memory.md` (if exists) for learnings from previous tasks
  - Agent instruction files (`AGENTS.md` / `CLAUDE.md`) for codebase conventions

The subagent handles the full cycle and returns:
- List of changed files
- A brief implementation summary
- A proposed commit message

**Handling complex issues**: If the subagent reports issues requiring significant architectural changes, consult the user and resume the subagent with the decision.

#### Git Commit

This section applies when a commit is needed — either per-task (when `commitPolicy = "per-task"`) or at the end of all tasks (when `commitPolicy = "end"`).

After recording learnings, commit changes using the commit message proposed by the implementation subagent.

1. **Check for commit message rules**
   - Look for project-specific commit conventions (e.g., `.gitmessage`, `CONTRIBUTING.md`, or repository rules)
   - If rules exist, instruct the implementation subagent to follow them when proposing the commit message

2. **Default to Conventional Commits**
   - If no project-specific rules exist, the implementation subagent should propose a message following [Conventional Commits](https://www.conventionalcommits.org/) format:
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

**Behavior by `commitPolicy`**:

| Policy | Per-task commit | End-of-phase commit |
|--------|----------------|---------------------|
| `per-task` | Yes — commit after each task completes | No — already committed per task |
| `end` | No — skip per-task commits | Yes — commit all accumulated changes after all tasks complete (see Phase 3) |
| `none` | No | No — user handles all commits manually |

When `commitPolicy = "end"`, each implementation subagent still proposes a commit message. Collect these messages and use them to compose a single combined commit message at the end.

When `commitPolicy = "none"`, implementation subagents still propose commit messages (for reference), but no commits are created. Also skip the agent instruction updates commit in Phase 3.

**Note**: If `plan.json` is not gitignored, including it in the commit ensures consistency when resuming interrupted work. If it is gitignored, it will be automatically excluded and the commit will proceed normally.

### Phase 3: Completion

Before reporting completion to user:

1. Verify all tasks in `plan.json` have `status = "done"`
2. Verify all todos are marked as completed
3. If any task is incomplete, return to Phase 2 and complete remaining tasks
4. If `commitPolicy = "end"`: Commit all accumulated implementation changes (see Batch Commit below)
5. Update agent instruction files with learnings — behavior depends on `updateAgentDocs` (see below)
6. Git commit the agent instruction updates (if `updateAgentDocs = "auto"` and `commitPolicy != "none"`, use commit message: `docs: update agent instructions with learnings from {slug}`)
7. Provide summary of completed work

#### Batch Commit (`commitPolicy = "end"`)

When `commitPolicy = "end"`, no per-task commits were made during Phase 2. Commit all implementation changes here:

1. Collect the commit messages proposed by each implementation subagent during Phase 2
2. Compose a single commit message that summarizes all tasks:
   - Use the plan title as the commit subject line
   - List individual task summaries in the commit body
   - Follow the same commit message rules (project conventions or Conventional Commits)
3. Stage and commit all changes
4. Do NOT push (user will decide when to push)

#### Update Agent Instruction Files

Behavior depends on the `updateAgentDocs` setting in `plan.json`:

- **`auto`** (default): Integrate learnings into agent instruction files and commit (full flow below)
- **`suggest`**: Write suggested updates to `.tasks/{YYYY-MM-DD}-{nn}-{slug}/agent-docs-suggestions.md` instead of modifying agent instruction files. Skip the external review of agent instruction updates and the corresponding git commit. The suggestion file should contain the same content that would have been added to agent instruction files, organized by target file and section, so the user can manually integrate them.

**The following steps apply only when `updateAgentDocs = "auto"`:**

Integrate universally applicable learnings from `memory.md` into agent instruction files (`AGENTS.md` and/or `CLAUDE.md`).

##### Step 1: Determine Update Targets

Scan the repository for `AGENTS.md` and `CLAUDE.md` files (they can exist at root AND in subdirectories). Then determine which files to update:

| Condition | Update target |
|---|---|
| Only `AGENTS.md` exists | `AGENTS.md` |
| Only `CLAUDE.md` exists | `CLAUDE.md` |
| Both exist independently | Both `AGENTS.md` and `CLAUDE.md` |
| One references the other (e.g., contains `@CLAUDE.md` or `@AGENTS.md`) | Only the file with actual content (skip the reference-only file) |

**Reference detection**: A file is considered a reference-only file if its primary content is a reference to the other file (e.g., `See @CLAUDE.md` or `@AGENTS.md`). Such files should NOT be updated — only the file with substantive content is the update target.

**If neither file exists anywhere**, create `AGENTS.md` at repository root.

##### Step 2: Find All Target Files

- Target files can exist at repository root AND in subdirectories
- Each file applies to its directory and descendants
- Example locations: `./AGENTS.md`, `./backend/CLAUDE.md`, `./frontend/AGENTS.md`

##### Step 3: Read and Understand Existing Structure

- Read the entire target file before making changes
- Identify existing sections and their purposes
- Understand the organizational pattern used in the file

##### Step 4: Review and Filter Learnings

Review ALL entries in `memory.md` and determine which belong in agent instruction files:

- `Scope` is a **hint, not a definitive filter** — the agent that wrote it may have misclassified entries
- `Scope: codebase` entries are strong candidates, but still verify they are truly universal
- `Scope: task-specific` entries should also be reviewed — some may contain patterns, conventions, or gotchas that apply beyond the current task
- Apply the include/exclude criteria in Step 6 as the final decision basis

##### Step 5: Match Learnings to Appropriate File

- Review each selected learning
- Determine which directory scope the learning applies to
- Update the target file closest to the relevant code
- Example: Backend database learnings → `./backend/AGENTS.md` (if exists) or `./AGENTS.md`

##### Step 6: Integrate into Existing Structure

DO NOT create a "Learnings" section:
- Find the most appropriate existing section for each learning
- If a section for that topic exists, add to it or update existing content
- If no suitable section exists, create a descriptive section name that matches the topic (e.g., "Database Patterns", "API Conventions", "Testing Guidelines")
- Merge related information rather than duplicating
- Keep entries concise and actionable
- Focus on "what every developer should know"

**Include:**

- Codebase-specific conventions discovered
- Non-obvious configuration requirements
- Integration patterns with external systems
- Common pitfalls and how to avoid them
- Testing patterns specific to this codebase

**Do NOT include:**

- Implementation details that only matter for this specific task and have no broader applicability
- Temporary workarounds
- Information already documented in README or other docs
- Generic best practices (not codebase-specific)
- A generic "Learnings" or "Learning" section (integrate into topic-specific sections instead)

#### External Review of Agent Instruction Updates

After updating agent instruction files, launch a review subagent for external review.

1. **Launch a new review subagent**
2. **Provide the updated files** — instruct the subagent to read the diff or full content of each updated agent instruction file
3. **Instruct the subagent to return findings** directly
4. **Explicitly instruct**: "Your ONLY role is code review. Return your findings, then stop. Do NOT fix code, do NOT implement anything, do NOT proceed to other tasks."
5. **Review criteria** for agent instruction files:
   - Are the learnings correctly scoped (codebase-wide, not task-specific)?
   - Are entries placed in appropriate sections?
   - Are entries concise, actionable, and useful for other developers?
   - Is there any duplication with existing content?
   - Does the content read naturally within the existing document structure?
6. **If issues exist**: Fix all identified issues, then resume the review subagent to re-review
7. **If no issues**: Proceed to git commit

## Important Rules

- **NEVER stop mid-workflow** - Complete ALL tasks from start to finish without interruption
- **Orchestrator stays lean** - Delegate the full task lifecycle to implementation subagents; only handle task sequencing, git commits, and agent instruction file updates
- **Respect workflow options** - Read `commitPolicy` and `updateAgentDocs` from `plan.json` at the start and follow them throughout execution
- **Execute tasks by dependency** - Pick any task where all dependencies are complete; no strict execution order
- **Complete each task fully before moving to next** - Implementation → Verification → Self-review → External review → Memory → Commit (if `per-task`) → Mark complete
- **Launch a new implementation subagent per task** - Each task gets a fresh implementation subagent with clean context to maintain quality regardless of plan size
- **Launch a new review subagent for Phase 3** - Agent instruction file review in Phase 3 gets a fresh subagent
- **Update appropriate agent instruction files** - AGENTS.md / CLAUDE.md can exist in root and subdirectories; determine update targets per Step 1 rules and match learnings to the closest relevant file
- **Create AGENTS.md if neither exists** - If no AGENTS.md or CLAUDE.md exists in the repository, create AGENTS.md at root with universal learnings
- **Save temporary files under the plan directory** - Any temporary files created during investigation or implementation (e.g., debug logs, analysis outputs, scratch notes) must be saved under `.tasks/{YYYY-MM-DD}-{nn}-{slug}/tmp/`. Do NOT save them in the project root or other locations. Clean up when no longer needed.
