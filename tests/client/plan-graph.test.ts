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

  test("resolves status before passes and keeps passes fallback", () => {
    const json = JSON.stringify({
      tasks: [
        { id: "s1", title: "status done", status: "done", passes: false, dependsOn: [] },
        {
          id: "s2",
          title: "status in progress",
          status: "in_progress",
          passes: true,
          dependsOn: ["s1"],
        },
        { id: "s3", title: "status invalid", status: "paused", passes: true, dependsOn: ["s2"] },
        { id: "p1", title: "passes done", passes: true, dependsOn: [] },
        { id: "p2", title: "passes pending", passes: false, dependsOn: ["p1"] },
      ],
    });

    const result = buildPlanGraph(json, "dark");
    expect(result.kind).toBe("graph");
    if (result.kind !== "graph") return;

    expect(result.mermaid).toContain("class t0 done");
    expect(result.mermaid).toContain("class t1 inProgress");
    expect(result.mermaid).toContain("class t2 pending");
    expect(result.mermaid).toContain("class t3 done");
    expect(result.mermaid).toContain("class t4 pending");
  });

  test("does not map dependencies to fallback node ids when task id is missing", () => {
    const json = JSON.stringify({
      tasks: [
        { title: "missing id", status: "done", dependsOn: [] },
        { id: "t0", title: "explicit id", status: "pending", dependsOn: [] },
        { id: "consumer", title: "consumer", status: "pending", dependsOn: ["t0"] },
      ],
    });

    const result = buildPlanGraph(json, "dark");
    expect(result.kind).toBe("graph");
    if (result.kind !== "graph") return;

    expect(result.mermaid).toContain("t1 --> t2");
    expect(result.mermaid).not.toContain("t0 --> t2");
  });
});
