# Orchestrator Instructions

## Core Principles

1. **Orchestrate, don't implement** - Delegate the full task lifecycle to implementation subagents, keeping your own context lean
2. **Execute tasks by dependency** - Pick any task with no unresolved dependencies and execute it
3. **Confirm implementation-agent mode before execution** - Before any task execution, ask the user whether implementation agents should run in `fresh` mode (new subagent per task) or `shared` mode (reuse one implementation subagent across tasks). Do NOT assume a default.
4. **Confirm implementation-agent candidate only for shared mode** - If the user selects `shared`, present the implementation-subagent candidates available in the current environment and ask the user to choose one. In `fresh` mode, keep implementation-agent selection flexible per task. Do NOT hardcode a specific agent name in this skill.
5. **Keep review independent per task** - Each task gets a fresh review subagent with no inherited parent context
6. **Pass delegated files by path, not by content** - When a subagent must read a file, verify the file exists and pass its path; do NOT preload or summarize the file in the orchestrator
7. **Complete each task fully** - Implementation → Verification → Pre-review handoff → External review as one unit per task
8. **Complete all tasks without stopping** - NEVER stop mid-workflow; continue until all tasks are finished

## Workflow

### Phase 1: Task Planning

Load the implementation metadata from `plan.json`, ensure packets are current, and register tasks as todos:

1. Load the implementation metadata from `plan.json`
2. Generate or refresh task packets (see Packet Preparation below)
3. Register all tasks as todos (all start as "pending")
4. Confirm the implementation-agent mode with the user (see Implementation Agent Mode below)
5. If the user selected `shared`, confirm the implementation-agent candidate with the user (see Implementation Agent Candidate below)
6. Ensure review is included after implementation phase

#### Loading the Plan

Read `plan.json` from the `.tasks/{YYYY-MM-DD}-{nn}-{slug}/` directory.

Do NOT read `plan.md` in the orchestrator. Treat `plan.json` as the orchestrator's source of truth for workflow metadata, task status, task titles, and the canonical relative path to the full plan document.

Resolve the full plan path from the `plan` field in `plan.json`, then derive packet paths from each task title in `plan.json`:

- `packets/common.md`
- `packets/{TaskPrefix}-implement.md`
- `packets/{TaskPrefix}-review.md`

#### Packet Preparation

Before executing any task, ensure the packet set under `packets/` is present and current.

Launch a dedicated packet generation subagent using the lightest available worker that can reliably perform deterministic file splitting and file I/O. This step is mechanical and should not use a planning-oriented implementation worker. Do NOT inherit parent context — the subagent must start with a clean context.

Before launching the packet generation subagent, verify only that these files exist and point to the expected locations. Do NOT open them or summarize them in the orchestrator.

**Pass only the following paths and metadata:**

- Task directory path (`.tasks/{YYYY-MM-DD}-{nn}-{slug}/`)
- Path to the canonical plan document resolved from the `plan` field in `plan.json`
- Path to `plan.json`
- Path to `packet-generator.md` in this skill directory
- Instruct the subagent to read `packet-generator.md` and follow it exactly

**Generation rules the subagent must enforce:**

- Packet task sections copied from `plan.md` must remain verbatim
- The shared common packet must copy everything before `## Tasks` verbatim
- Each packet must include `Generated from plan.md at {timestamp}` in its header
- If `plan.md` is newer than `common.md`, regenerate the common packet
- If `plan.md` is newer than any packet, regenerate the affected packets
- If any packet is missing, generate it before returning

Store the packet-generator agent ID only as long as needed for this preparation step, then close it after successful completion.

The packet-generator subagent must read the source files directly from the provided paths. If packet generation fails, fix the path or rerun generation; do NOT inspect packet contents in the orchestrator as a fallback.

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

#### Implementation Agent Mode

Before Phase 2 begins, ask the user which implementation-agent mode to use for this run:

- `fresh`: launch a new implementation subagent for each task to keep task-level implementation context clean
- `shared`: launch one implementation subagent once, then resume the same subagent across tasks to reduce repeated startup cost

Do NOT choose a default yourself. Do NOT begin Phase 2 until the user explicitly selects `fresh` or `shared`.

After the user answers:

- Store the selected mode in session memory as `implementationAgentMode`
- Treat that value as fixed for the rest of the run unless the user explicitly changes direction
- Apply the selected mode consistently for task execution, fix loops, and memory recording

#### Implementation Agent Candidate

Only if `implementationAgentMode = "shared"`, present the implementation-subagent candidates available in the current environment and ask the user to choose one for this run.

Requirements:

- Do NOT hardcode any specific implementation-agent name in this skill
- Do NOT silently auto-select a candidate in `shared` mode
- If only one candidate is available in `shared` mode, still ask the user to confirm it explicitly
- Present concise trade-offs for the available candidates based on the current environment's metadata or tool descriptions
- In `fresh` mode, do NOT ask the user to lock one implementation-agent candidate for the whole run

After the user answers:

- Store the selected candidate in session memory as `implementationAgentCandidate`
- Treat that value as fixed for the rest of the run unless the user explicitly changes direction
- Use that selected candidate for all implementation-subagent launches in this run while `implementationAgentMode = "shared"`

### Phase 2: Task Execution

The orchestrator delegates implementation and review to subagents, coordinating the workflow while keeping its own context lean.

**Task Execution Loop**:

1. **Get next task**: Find the next executable task from `plan.json`
   - Task has `status = "pending"`
   - All tasks in `dependsOn` have `status = "done"` (or `dependsOn` is empty)
2. **Mark task as in progress**: Set `status: "in_progress"` in `plan.json`
3. **Compute task packet paths**: Derive the shared common packet path and the current task's packet paths from its task prefix
4. **Delegate implementation**: Use the confirmed implementation-agent mode, and when in `shared` mode, the confirmed implementation-agent candidate, to launch or resume the implementation subagent (see Implementation below)
5. **Validate the pre-review handoff**: Confirm the implementation subagent returned changed files, verification results, and acceptance-criteria status with evidence
6. **Request external review**: Launch a review subagent (see External Review below)
7. **Fix loop**: If review finds issues, coordinate fixes between subagents (see External Review below)
8. **Record learnings**: Resume the implementation subagent to write memory.md (see Memory Recording below)
9. **Complete task**:
   - Mark task as complete in `plan.json` (set `status: "done"`)
   - If `commitPolicy = "per-task"`: Git commit all changes (see Git Commit below)
   - If `commitPolicy = "end"` or `"none"`: Skip commit
   - Update todo status
10. **Repeat**: Go to step 1 until all tasks are complete

#### Implementation

Use the implementation-agent mode selected in Phase 1. If the mode is `shared`, also use the implementation-agent candidate selected in Phase 1.

**Mode definitions:**

- `fresh`: Launch a new implementation subagent for each task. Do NOT inherit parent context. Use that task-specific subagent only for that task's implementation, fix loops, and memory recording. Choose the implementation-agent candidate per task based on the task's needs and the current environment; do not require one run-wide candidate choice.
- `shared`: Reuse one implementation subagent across tasks. Launch it once without inheriting parent context, then resume the same subagent for subsequent tasks, fix loops, and memory recording. While `shared` mode is active, do NOT launch additional implementation subagents for normal task execution. Use the user-selected shared-mode implementation-agent candidate for that subagent. Read `packets/common.md` only on the shared subagent's initial launch; do NOT re-read it on later task resumes in the same run.

Before launching or resuming the implementation subagent, verify only that these files exist and point to the expected task inputs. Do NOT open them or summarize them in the orchestrator.

In `shared` mode, launch or resume the implementation subagent using the user-selected implementation-agent candidate for this run. Do NOT substitute a different candidate unless the user explicitly changes direction.

**How to choose the implementation subagent action:**

- If `implementationAgentMode = "fresh"`:
  - Launch a new implementation subagent for the current task
  - Choose the implementation-agent candidate for that task according to the task's needs and the current environment
  - Store that task's implementation agent ID in session memory for fix loops and memory recording within the same task
- If `implementationAgentMode = "shared"`:
  - If no shared implementation subagent exists yet, launch one, store its agent ID in session memory, and include `packets/common.md` in the delegated inputs
  - If a shared implementation subagent already exists, resume that same subagent for the current task and do NOT ask it to re-read `packets/common.md`
  - Do NOT launch a second implementation subagent for another task unless the user explicitly changes the mode or the shared subagent is no longer usable

Whenever you delegate implementation, explicitly note whether you **launched** or **resumed** the implementation subagent so the execution path is auditable.
Also note which implementation-agent candidate you used. In `shared` mode, it must match the user-selected shared-mode candidate.

**Pass only the following paths and metadata:**

- Task directory path (`.tasks/{YYYY-MM-DD}-{nn}-{slug}/`)
- Current task prefix and ID
- Path to the task's implementation packet
- Path to `implementer.md` in this skill directory
- Instruct the subagent to read `implementer.md` and follow it
- If `implementationAgentMode = "fresh"`:
  - Pass the path to `packets/common.md`
  - Instruct the subagent to open and read these files directly:
    - `packets/common.md`
    - The task's implementation packet
    - `memory.md` (if exists) for learnings from previous tasks
    - Agent instruction files (`AGENTS.md` / `CLAUDE.md`) for codebase conventions
- If `implementationAgentMode = "shared"` and this is the shared subagent's first launch:
  - Pass the path to `packets/common.md`
  - Instruct the subagent to open and read these files directly:
    - `packets/common.md`
    - The task's implementation packet
    - `memory.md` (if exists) for learnings from previous tasks
    - Agent instruction files (`AGENTS.md` / `CLAUDE.md`) for codebase conventions
- If `implementationAgentMode = "shared"` and this is a later task resume:
  - Do NOT pass `packets/common.md`
  - Instruct the subagent to open and read these files directly:
    - The task's implementation packet
    - `memory.md` (if exists) for learnings from previous tasks
    - Agent instruction files (`AGENTS.md` / `CLAUDE.md`) only if they need to be re-opened for the current task

**Instruct the subagent to perform:**

1. Implement the task according to the implementation packet
2. Run verification checks (see Verification in implementer.md)
3. Prepare the pre-review handoff required by implementer.md
4. Return:
   - list of changed files
   - verification commands run and results
   - explicit acceptance-criteria status with evidence for each criterion
   - a brief implementation summary

**Explicitly instruct**: "You are the implementation subagent. You are assigned ONLY task {prefix} right now. Do NOT work on any other task unless I explicitly resume you with a new assignment. Do NOT make git commits — I (the orchestrator) handle all git operations. Do NOT modify plan.json — progress tracking is my exclusive responsibility. Open the provided files yourself; I am passing file paths, not preloaded contents. If I do not pass `packets/common.md`, continue using the common packet context you already loaded earlier in this run. After completing implementation, verification, and the pre-review handoff, return your results to me immediately and stop."

**Store the agent ID** according to the selected mode so it can be reused for fix loops later in the review phase.
If `implementationAgentMode = "shared"`, the stored shared implementation subagent must correspond to the selected `implementationAgentCandidate`.

**Handling complex issues**: If the subagent reports issues requiring significant architectural changes, consult the user and resume the subagent with the decision.

#### External Review

After the implementation subagent completes, launch a review subagent for external review.

**IMPORTANT**: The implementation subagent must complete verification and return a complete pre-review handoff BEFORE the orchestrator requests external review.

##### Pre-Review Handoff Gate

Before launching the review subagent, confirm the implementation subagent returned:

- The list of changed files
- Verification commands and results
- Acceptance-criteria status for every criterion in the assigned task
- Concrete evidence for every acceptance criterion

If any of these are missing or incomplete, resume the implementation subagent and require a corrected handoff before external review begins.

##### Review Flow

1. **Launch a new review subagent** for this task and store the agent ID in session memory

2. **Provide task context**
   - Task directory path (`.tasks/{YYYY-MM-DD}-{nn}-{slug}/`)
   - Current task prefix and ID
   - Path to `packets/common.md`
   - Path to the task's review packet
   - Path to `reviewer.md` in this skill directory
   - The list of files changed in this task (received from the implementation subagent)
   - The implementation subagent's verification summary
   - The implementation subagent's acceptance-criteria status and evidence
   - Instruct the subagent to read `reviewer.md` and follow it
   - Instruct the subagent to open `packets/common.md`, the review packet, and any changed files directly from the provided paths
   - Instruct the subagent to use `packets/common.md` plus the review packet as the primary task specification
   - **Explicitly instruct**: "You are the review subagent. Your ONLY role is code review — you are NOT the implementer. Do NOT fix code, do NOT implement anything, do NOT modify plan.json. Open the provided files yourself; I am passing file paths, not preloaded contents. Write your findings to mail/ files and return to me immediately with an explicit status (`APPROVED` or `CHANGES_REQUESTED`) and the relevant mail file path."

3. **If issues exist**:
   - **Resume the implementation subagent**: pass only the review file path (`mail/{task-prefix}-review-{nn}.md`) and instruct it to read the file itself, fix issues, re-run verification, re-check the acceptance criteria, and write a response file (`mail/{task-prefix}-review-response-{nn}.md`)
   - **Resume the review subagent**: pass only the response file path and instruct it to read the file itself before re-reviewing the codebase
   - Repeat until the review subagent returns `APPROVED`

4. **If no issues**:
   - External review passed
   - Proceed to Memory Recording

#### Memory Recording

After external review passes, use the implementation subagent selected by `implementationAgentMode` to record learnings in `.tasks/{YYYY-MM-DD}-{nn}-{slug}/memory.md`. The implementation subagent experienced the full cycle (implementation, verification, pre-review handoff, and fix loops) and is best positioned to capture meaningful learnings.

Instruct the subagent to:
- Read the review exchange files in `mail/` to also capture learnings from the review process
- Write entries to `memory.md` following the template in implementer.md
- Return to the orchestrator after writing

When delegating memory recording:

- In `fresh` mode, resume the current task's implementation subagent
- In `shared` mode, resume the shared implementation subagent

Pass file paths only. Do NOT preload or summarize the review exchange in the orchestrator.

#### Git Commit

This section applies when a commit is needed — either per-task (when `commitPolicy = "per-task"`) or at the end of all tasks (when `commitPolicy = "end"`).

After recording learnings, commit changes using a message derived mechanically from `plan.json`. Do NOT ask the implementation subagent to propose or revise the commit message, and do NOT rewrite the meaning based on review rounds or fix-loop context.

1. **Check for commit message rules**
   - Look for project-specific commit conventions (e.g., `.gitmessage`, `CONTRIBUTING.md`, or repository rules)
   - If rules exist, apply them when formatting the final commit message

2. **Select the source title by commit unit**
   - For per-task commits, use the current task's `tasks[].title`
   - For end-of-phase commits, use the top-level `title` from `plan.json`

3. **Normalize mechanically**
   - When the source is `tasks[].title`, remove only the leading task prefix token for the current task (for example `X1`, `F1`) plus any immediately following separator punctuation and whitespace
   - Do NOT paraphrase, summarize, or otherwise change the remaining wording

4. **Default to Conventional Commits**
   - If no project-specific rules exist, format the commit message using [Conventional Commits](https://www.conventionalcommits.org/) format:
     ```
     <type>(<scope>): <description>
     ```
   - Use the normalized title as the `<description>` text
   - Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
   - Scope: affected module (e.g., `auth`, `api`, `database`)
   - Example: `feat(auth): add user authentication endpoint`

5. **Stage and commit**
   - Stage all changes (if `plan.json` is not gitignored, include it as well)
   - Create commit with appropriate message
   - Do NOT push (user will decide when to push)

**Behavior by `commitPolicy`**:

| Policy | Per-task commit | End-of-phase commit |
|--------|----------------|---------------------|
| `per-task` | Yes — commit after each task completes | No — already committed per task |
| `end` | No — skip per-task commits | Yes — commit all accumulated changes after all tasks complete (see Phase 3) |
| `none` | No | No — user handles all commits manually |

**Note**: If `plan.json` is not gitignored, including it in the commit ensures consistency when resuming interrupted work. If it is gitignored, it will be automatically excluded and the commit will proceed normally.

### Phase 3: Completion

Before reporting completion to user:

1. Verify all tasks in `plan.json` have `status = "done"`
2. Verify all todos are marked as completed
3. If any task is incomplete, return to Phase 2 and complete remaining tasks
4. If `commitPolicy = "end"`: Commit all accumulated implementation changes (see Batch Commit below)
5. Update agent instruction files with learnings — behavior depends on `updateAgentDocs` (see below)
6. Git commit the agent instruction updates (if `updateAgentDocs = "auto"` and `commitPolicy != "none"`, use commit message: `docs: update agent instructions with learnings from {slug}`)
7. If `implementationAgentMode = "shared"` and the shared implementation subagent is still running, close it after all workflow steps are complete
8. Provide summary of completed work

#### Batch Commit (`commitPolicy = "end"`)

When `commitPolicy = "end"`, no per-task commits were made during Phase 2. Commit all implementation changes here:

1. Derive the commit subject from the top-level `title` in `plan.json`
2. Format the commit using the same commit message rules from the Git Commit section
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

After updating agent instruction files, launch a new review subagent:

1. **Launch a new review subagent** and store the agent ID in session memory
2. **Provide context**:
   - Path to `reviewer.md` in this skill directory
   - The updated agent instruction files (paths)
   - Instruct the subagent to read `reviewer.md` and follow it, including the "Agent Instruction Review" section for additional criteria
   - Instruct the subagent to return an explicit status (`APPROVED` or `CHANGES_REQUESTED`) and the relevant mail file path without expecting the orchestrator to read the mail body
3. **If issues exist**: Fix the issues based on the review subagent's returned summary, write `mail/agents-review-response-{nn}.md`, then resume the subagent by passing only the response file path for re-review
4. **If no issues**: Proceed to git commit

## Important Rules

- **NEVER stop mid-workflow** - Complete ALL tasks from start to finish without interruption
- **Orchestrator stays lean** - The orchestrator delegates implementation, review, and memory recording to subagents; it only handles task sequencing, git commits, and agent instruction file updates
- **No default implementation-agent mode** - Before Phase 2, ask the user to choose `fresh` or `shared`. Do NOT assume or infer a default.
- **No default shared-mode implementation-agent candidate** - If the user selects `shared`, present the available implementation-subagent candidates and ask the user to choose one. Do NOT assume or infer a default.
- **Do not read delegated input files in the orchestrator** - For packets, `memory.md`, review files, and agent instruction files that a subagent must consume, verify existence/path/freshness only and pass the path onward
- **Do not read `plan.md` in the orchestrator** - Read only `plan.json`, resolve the plan path from its `plan` field, and pass that path to the packet-generation subagent when needed
- **Do not read review mail bodies in the orchestrator** - Use subagent return statuses and passed file paths to control review loops; leave detailed mail contents to the relevant subagents
- **Route packet generation to a very lightweight worker** - Packet generation is a narrow mechanical task; prefer the fastest reliable worker for file splitting rather than a planning-oriented implementation worker
- **Respect workflow options** - Read `commitPolicy` and `updateAgentDocs` from `plan.json` at the start and follow them throughout execution
- **Execute tasks by dependency** - Pick any task where all dependencies are complete; no strict execution order
- **Complete each task fully before moving to next** - Implementation → Verification → Pre-review handoff → External review → Memory → Commit (if `per-task`) → Mark complete
- **Respect the selected shared-mode implementation-agent candidate exactly** - In `shared` mode, use the candidate chosen by the user for every implementation-subagent launch in this run unless the user explicitly changes direction.
- **Respect the selected implementation-agent mode exactly** - In `fresh` mode, launch a new implementation subagent per task and do NOT reuse it across tasks. In `shared` mode, reuse the same implementation subagent across tasks and do NOT launch extra implementation subagents for normal task execution.
- **Reuse subagents within a task** - When fix→re-review loops occur within a single task, resume the same implementation and review subagents to preserve context
- **Keep reviews fresh per task** - Launch a new review subagent for every task review and for Phase 3 agent-instruction review
- **Communicate through `mail/` files** - Subagents exchange review findings and responses via files in `mail/` to prevent information loss through orchestrator relay
- **Implementation subagent writes memory.md** - After external review passes, resume the implementation subagent to record learnings (it has the richest context from the full implementation and review cycle)
- **Update appropriate agent instruction files** - AGENTS.md / CLAUDE.md can exist in root and subdirectories; determine update targets per Step 1 rules and match learnings to the closest relevant file
- **Create AGENTS.md if neither exists** - If no AGENTS.md or CLAUDE.md exists in the repository, create AGENTS.md at root with universal learnings
- **Save temporary files under the plan directory** - Any temporary files created during investigation or implementation (e.g., debug logs, analysis outputs, scratch notes) must be saved under `.tasks/{YYYY-MM-DD}-{nn}-{slug}/tmp/`. Do NOT save them in the project root or other locations. Clean up when no longer needed.
- Implementation subagent fixes review findings autonomously based on fix complexity
- Implementation subagent reports to orchestrator when fixes require significant architectural changes; orchestrator consults user
