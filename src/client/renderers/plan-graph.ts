type PlanTask = {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  passes?: unknown;
  dependsOn?: unknown;
};

type PlanData = {
  tasks: unknown[];
};

export type PlanGraphResult =
  | { kind: "graph"; mermaid: string; nodes: PlanGraphNode[] }
  | { kind: "error"; message: string };

type GraphTheme = "dark";

export type PlanGraphNode = {
  id: string;
  title: string;
  label: string;
};

const graphTheme: Record<GraphTheme, Record<string, string>> = {
  dark: {
    doneFill: "#1f7a3d",
    doneStroke: "#2ecc71",
    inProgressFill: "#1f4f7a",
    inProgressStroke: "#7cc4ff",
    pendingFill: "#2d3748",
    pendingStroke: "#4a5568",
    missingFill: "#3b3b3b",
    missingStroke: "#6b6b6b",
    text: "#e6edf3",
  },
};

const escapeLabel = (label: string) => {
  return label
    .replace(/[&<>]/g, " ")
    .replace(/[\]()[|"]/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();
};

type GraphTaskState = "done" | "in_progress" | "pending";

const hasOwn = (value: object, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

const resolveTaskState = (task: PlanTask): GraphTaskState => {
  if (hasOwn(task, "status")) {
    if (task.status === "done") return "done";
    if (task.status === "in_progress") return "in_progress";
    return "pending";
  }

  return task.passes === true ? "done" : "pending";
};

export const buildPlanGraph = (planJsonText: string, theme: GraphTheme): PlanGraphResult => {
  let data: PlanData;
  try {
    data = JSON.parse(planJsonText) as PlanData;
  } catch {
    return { kind: "error", message: "plan.json is not valid JSON." };
  }

  if (!data || !Array.isArray(data.tasks)) {
    return { kind: "error", message: "plan.json does not contain a tasks array." };
  }

  const palette = graphTheme[theme];
  const lines: string[] = ["flowchart TD"];
  const graphNodes: PlanGraphNode[] = [];
  lines.push(
    `  classDef done fill:${palette.doneFill},stroke:${palette.doneStroke},color:${palette.text}`,
  );
  lines.push(
    `  classDef inProgress fill:${palette.inProgressFill},stroke:${palette.inProgressStroke},color:${palette.text}`,
  );
  lines.push(
    `  classDef pending fill:${palette.pendingFill},stroke:${palette.pendingStroke},color:${palette.text}`,
  );
  lines.push(
    `  classDef missing fill:${palette.missingFill},stroke:${palette.missingStroke},stroke-dasharray: 4 4,color:${palette.text}`,
  );

  const nodes = data.tasks.map((task, index) => {
    const planTask = (typeof task === "object" && task !== null ? task : {}) as PlanTask;
    const nodeId = `t${index}`;
    const resolvedId =
      typeof planTask.id === "string" && planTask.id.trim().length > 0 ? planTask.id : null;
    const taskId = resolvedId ?? nodeId;
    const taskTitle =
      typeof planTask.title === "string" && planTask.title.trim().length > 0
        ? planTask.title
        : taskId;
    const state = resolveTaskState(planTask);
    return { task: planTask, nodeId, taskId, taskTitle, resolvedId, state };
  });
  const idMap = new Map<string, string[]>();
  const missingMap = new Map<string, string>();

  for (const node of nodes) {
    if (node.resolvedId) {
      const existing = idMap.get(node.resolvedId) ?? [];
      existing.push(node.nodeId);
      idMap.set(node.resolvedId, existing);
    }

    const label = escapeLabel(node.taskTitle);
    lines.push(`  ${node.nodeId}["${label}"]`);
    graphNodes.push({ id: node.taskId, title: node.taskTitle, label });
  }

  const ensureMissingNode = (dep: string) => {
    const existing = missingMap.get(dep);
    if (existing) return existing;
    const nodeId = `m${missingMap.size}`;
    missingMap.set(dep, nodeId);
    const label = escapeLabel(`Missing: ${dep}`);
    lines.push(`  ${nodeId}["${label}"]`);
    return nodeId;
  };

  for (const node of nodes) {
    const nodeIds = [node.nodeId];
    const deps = Array.isArray(node.task.dependsOn)
      ? Array.from(new Set(node.task.dependsOn.filter((dep): dep is string => typeof dep === "string")))
      : [];
    for (const dep of deps) {
      const depNodes = idMap.get(dep);
      const targets = depNodes && depNodes.length > 0 ? depNodes : [ensureMissingNode(dep)];
      for (const depId of targets) {
        for (const nodeId of nodeIds) {
          lines.push(`  ${depId} --> ${nodeId}`);
        }
      }
    }
  }

  for (const node of nodes) {
    if (node.state === "done") {
      lines.push(`  class ${node.nodeId} done`);
      continue;
    }
    if (node.state === "in_progress") {
      lines.push(`  class ${node.nodeId} inProgress`);
      continue;
    }
    lines.push(`  class ${node.nodeId} pending`);
  }

  for (const nodeId of missingMap.values()) {
    lines.push(`  class ${nodeId} missing`);
  }

  return { kind: "graph", mermaid: lines.join("\n"), nodes: graphNodes };
};
