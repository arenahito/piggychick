---
name: impl-do
description: |
  Workflow for executing implementation tasks using an orchestrator pattern.
  Use this skill when you need to:
  (1) Execute a prepared implementation plan
  (2) Orchestrate tasks by delegating implementation and review to subagents
  (3) For each task: implement → verify → pre-review handoff → external review (all via subagents)
  This skill enforces: (a) dependency-based task execution, (b) per-task subagent isolation, (c) per-task review cycle.
metadata:
  short-description: Execute implementation plans with orchestrator pattern and per-task subagent isolation
---

# Implementation Workflow

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
