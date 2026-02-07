import { describe, expect, test } from "bun:test";
import { buildPlanGraph } from "../../src/client/renderers/plan-graph";

describe("buildPlanGraph", () => {
  test("returns error for invalid JSON", () => {
    const result = buildPlanGraph("{", "dark");
    expect(result.kind).toBe("error");
  });

  test("returns error when tasks array is missing", () => {
    const result = buildPlanGraph(JSON.stringify({}), "dark");
    expect(result.kind).toBe("error");
  });

  test("builds graph with missing dependency nodes and escaped labels", () => {
    const json = JSON.stringify({
      tasks: [
        { id: "a", title: "Task <A>", passes: true, dependsOn: [] },
        { id: "b", title: "Task [B]", passes: false, dependsOn: ["a", "missing"] },
      ],
    });

    const result = buildPlanGraph(json, "dark");
    expect(result.kind).toBe("graph");
    if (result.kind !== "graph") return;

    expect(result.nodes.length).toBe(2);
    expect(result.mermaid).toContain("Missing: missing");
    expect(result.mermaid).not.toContain("Task <A>");
    expect(result.mermaid).not.toContain("Task [B]");
    expect(result.mermaid).toContain("class t0 done");
    expect(result.mermaid).toContain("class t1 pending");
  });
});
