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
            "passes": false,
            "dependsOn": []
        },
        {
            "id": "{uuid}",
            "title": "{TaskPrefix}: {Task Title}",
            "passes": false,
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
| `passes` | boolean | Whether the task is complete (initially `false`) |
| `dependsOn` | array | Array of task UUIDs that must be completed first |

## Example

See [plan.json](plan.json) for a complete example.

## yq Commands

### Get Next Executable Task

Get the first task where `passes = false` and all dependencies have `passes = true`:

```bash
yq -o=json -r '
  .tasks as $all |
  [.tasks[] |
  select(.passes == false) |
  select(
    (.dependsOn | length) == 0 or
    (.dependsOn | all_c(. as $dep | $all | map(select(.id == $dep)) | .[0].passes == true))
  )] | .[0]
' plan.json
```

### Mark Task as Complete

Update `passes` to `true` for a specific task ID:

```bash
yq -i -o=json '
  (.tasks[] | select(.id == "TARGET_TASK_ID")).passes = true
' plan.json
```
