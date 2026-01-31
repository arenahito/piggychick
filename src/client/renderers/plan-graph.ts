type PlanTask = {
  id: string;
  title: string;
  passes: boolean;
  dependsOn: string[];
};

type PlanData = {
  tasks: PlanTask[];
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
    passFill: "#1f7a3d",
    passStroke: "#2ecc71",
    failFill: "#2d3748",
    failStroke: "#4a5568",
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
    `  classDef pass fill:${palette.passFill},stroke:${palette.passStroke},color:${palette.text}`,
  );
  lines.push(
    `  classDef fail fill:${palette.failFill},stroke:${palette.failStroke},color:${palette.text}`,
  );
  lines.push(
    `  classDef missing fill:${palette.missingFill},stroke:${palette.missingStroke},stroke-dasharray: 4 4,color:${palette.text}`,
  );

  const nodes = data.tasks.map((task, index) => ({ task, nodeId: `t${index}` }));
  const idMap = new Map<string, string[]>();
  const missingMap = new Map<string, string>();

  for (const node of nodes) {
    const existing = idMap.get(node.task.id) ?? [];
    existing.push(node.nodeId);
    idMap.set(node.task.id, existing);

    const label = escapeLabel(node.task.title || node.task.id);
    lines.push(`  ${node.nodeId}["${label}"]`);
    graphNodes.push({ id: node.task.id, title: node.task.title, label });
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
    const deps = Array.isArray(node.task.dependsOn) ? Array.from(new Set(node.task.dependsOn)) : [];
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
    lines.push(`  class ${node.nodeId} ${node.task.passes ? "pass" : "fail"}`);
  }

  for (const nodeId of missingMap.values()) {
    lines.push(`  class ${nodeId} missing`);
  }

  return { kind: "graph", mermaid: lines.join("\n"), nodes: graphNodes };
};
