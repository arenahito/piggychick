---
name: impl-do
description: |
  Workflow for executing implementation tasks using an orchestrator pattern.
  Use this skill ONLY when either:
  (1) there is an existing implementation plan prepared by `impl-plan`, or
  (2) the user explicitly names or requests the `impl-do` skill.
  Do NOT use this skill automatically just because a task has multiple steps, would benefit from orchestration, or already has some other kind of plan.
  When it is active, use it to:
  (1) Execute a prepared implementation plan
  (2) Orchestrate tasks in either delegated implementation mode or parent implementation mode
  (3) For each task: implement → verify → pre-review handoff → external review
  This skill enforces: (a) dependency-based task execution, (b) per-task review cycle.
metadata:
  short-description: Execute implementation plans with orchestrator pattern
---

# Implementation Workflow

## Activation

Use this skill only when one of the following is true:

- An `impl-plan` run already produced the task directory and plan artifacts that this workflow will execute
- The user explicitly asks to use `impl-do`

Do not activate it implicitly for every implementation request, even when the work is large or a plan exists in some other format.

## Task Directory

This workflow operates on a task directory at `.tasks/{YYYY-MM-DD}-{nn}-{slug}/`.

Role-specific instructions define which files under that directory each role may read or write.

## Startup Gate

Before reading your role file, do NOT open any task file under `.tasks/`.

For the orchestrator role, the first allowed read is `orchestrator.md` only.

## Documentation Language

All documents under `.tasks/` must be written in **English**.

## Role Routing

This skill consists of role-specific instruction files. Read **only** the file for your role:

- **Orchestrator**: Read [orchestrator.md](orchestrator.md)
- **Packet generation subagent**: Read [packet-generator.md](packet-generator.md)
- **Implementation subagent**: Read [implementer.md](implementer.md)
- **Review subagent**: Read [reviewer.md](reviewer.md)
