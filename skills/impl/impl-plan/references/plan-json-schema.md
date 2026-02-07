# Plan JSON Schema

Machine-readable progress tracking file saved alongside `plan.md`.

## Schema

```json
{
    "title": "{Plan Title}",
    "plan": "plan.md",
    "tasks": [
        {
            "id": "{uuid}",
            "title": "{TaskPrefix}: {Task Title}",
            "status": "pending",
            "dependsOn": []
        },
        {
            "id": "{uuid}",
            "title": "{TaskPrefix}: {Task Title}",
            "status": "pending",
            "dependsOn": ["{dependent-uuid}"]
        }
    ]
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Plan title (same as in plan.md) |
| `plan` | string | Relative path to the plan document |
| `tasks` | array | Array of task objects |

### Task Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Task UUID (must match the ID in plan.md) |
| `title` | string | Task prefix and title (e.g., "B1: Create User Model") |
| `status` | string | Task status: `"pending"` \| `"in_progress"` \| `"done"` (initially `"pending"`) |
| `dependsOn` | array | Array of task UUIDs that must be completed first |

### Status Values

| Value | Description |
|-------|-------------|
| `pending` | Not started (initial value) |
| `in_progress` | Currently being implemented |
| `done` | Implementation and verification complete (passes all acceptance criteria) |

## Example

See [plan.json](plan.json) for a complete example.

## yq Commands

### Get Next Executable Task

Get the first task where `status = "pending"` and all dependencies have `status = "done"`:

```bash
yq -o=json -r '
  .tasks as $all |
  [.tasks[] |
  select(.status == "pending") |
  select(
    (.dependsOn | length) == 0 or
    (.dependsOn | all_c(. as $dep | $all | map(select(.id == $dep)) | .[0].status == "done"))
  )] | .[0]
' plan.json
```

### Mark Task as In Progress

Update `status` to `"in_progress"` for a specific task ID:

```bash
yq -i -o=json '
  (.tasks[] | select(.id == "TARGET_TASK_ID")).status = "in_progress"
' plan.json
```

### Mark Task as Done

Update `status` to `"done"` for a specific task ID:

```bash
yq -i -o=json '
  (.tasks[] | select(.id == "TARGET_TASK_ID")).status = "done"
' plan.json
```
