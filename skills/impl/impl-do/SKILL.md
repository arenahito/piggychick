---
name: impl-do
description: |
  Workflow for executing implementation tasks using an orchestrator pattern.
  Use this skill when you need to:
  (1) Execute a prepared implementation plan
  (2) Orchestrate tasks by delegating full lifecycle to implementation subagents
  (3) For each task: implement → verify → self-review → external review (all via subagents)
  This skill enforces: (a) dependency-based task execution, (b) per-task subagent isolation, (c) nested review within implementation subagents.
metadata:
  short-description: Execute implementation plans with orchestrator pattern and nested subagent review
---

# Implementation Workflow

## Reference

This workflow uses files from the `.tasks/{YYYY-MM-DD}-{nn}-{slug}/` directory created by impl-plan:

- **plan.md** - Human-readable plan with task descriptions, file paths, and acceptance criteria
- **plan.json** - Machine-readable task list and workflow options for tracking progress
- **memory.md** - Learnings recorded during task execution (created by this workflow)

See [plan-json-schema.md](../impl-plan/references/plan-json-schema.md) for:
- Schema definition of `plan.json` (including `commitPolicy` and `updateAgentDocs` options)
- yq commands to query next executable task and mark tasks complete

## Documentation Language

All documents under `.tasks/` must be written in **English**.

## Role Routing

This skill consists of role-specific instruction files. Read **only** the file for your role:

- **Orchestrator**: Read [orchestrator.md](orchestrator.md)
- **Implementation subagent**: Read [implementer.md](implementer.md)
- **Review subagent**: Your instructions are provided in the launch prompt
