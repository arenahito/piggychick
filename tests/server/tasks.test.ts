import { describe, expect, test } from "bun:test";
import { link, mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPrd, createTempDir, removeTempDir } from "../helpers/fs";
import {
  listPrds,
  listRoots,
  readMarkdown,
  readMarkdownByRoot,
  readPlan,
  readPlanByRoot,
  TasksError,
} from "../../src/server/tasks";

const withTempRoot = async (fn: (root: string) => Promise<void>) => {
  const root = await createTempDir("pgch-tasks");
  try {
    await fn(root);
  } finally {
    await removeTempDir(root);
  }
};

const withTempConfig = async (
  fn: (options: { projectRoot: string; tasksRoot: string; configPath: string }) => Promise<void>,
) => {
  const projectRoot = await createTempDir("pgch-root");
  const tasksRoot = join(projectRoot, ".tasks");
  await mkdir(tasksRoot, { recursive: true });
  const configDir = await createTempDir("pgch-config");
  const configPath = join(configDir, "config.jsonc");
  await writeFile(
    configPath,
    JSON.stringify({ tasksDir: ".tasks", roots: [{ path: projectRoot }] }, null, 2),
    "utf8",
  );
  try {
    await fn({ projectRoot, tasksRoot, configPath });
  } finally {
    await removeTempDir(projectRoot);
    await removeTempDir(configDir);
  }
};

describe("listPrds", () => {
  test("includes only PRDs with plan.md and plan.json", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha");

      const missingJson = join(root, "missing-json");
      await mkdir(missingJson, { recursive: true });
      await writeFile(join(missingJson, "plan.md"), "# Plan", "utf8");

      const missingMd = join(root, "missing-md");
      await mkdir(missingMd, { recursive: true });
      await writeFile(join(missingMd, "plan.json"), JSON.stringify({ tasks: [] }), "utf8");

      const payload = await listPrds(root);
      expect(payload.prds.map((prd) => prd.id)).toEqual(["alpha"]);
    });
  });

  test("computes progress from plan.json and sorts PRDs", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha", { planJson: { tasks: [{ passes: true }] } });
      await createPrd(root, "beta", { planJson: { tasks: [{ passes: false }] } });
      await createPrd(root, "gamma", { planJson: { tasks: [{ passes: true }, {}] } });

      const payload = await listPrds(root);
      expect(payload.prds.map((prd) => prd.id)).toEqual(["alpha", "beta", "gamma"]);

      const progress = new Map(payload.prds.map((prd) => [prd.id, prd.progress]));
      expect(progress.get("alpha")).toBe("done");
      expect(progress.get("beta")).toBe("not_started");
      expect(progress.get("gamma")).toBe("in_progress");
    });
  });

  test("collects docs, excludes plan.md, and filters invalid IDs", async () => {
    await withTempRoot(async (root) => {
      const prdDir = await createPrd(root, "docs", {
        docs: [
          { name: "alpha.md", content: "# A" },
          { name: "beta.md", content: "# B" },
        ],
      });

      try {
        await writeFile(join(prdDir, "bad..md"), "# Bad", "utf8");
      } catch {
        // ignore invalid filename on this platform
      }

      const payload = await listPrds(root);
      const docs = payload.prds[0]?.docs ?? [];
      expect(docs).toEqual(["alpha", "beta"]);
    });
  });

  test("excludes symlinked or hard-linked markdown files when possible", async () => {
    await withTempRoot(async (root) => {
      const prdDir = await createPrd(root, "linked", {
        docs: [{ name: "source.md", content: "# Source" }],
      });

      let createdSymlink = false;
      try {
        await symlink(join(prdDir, "source.md"), join(prdDir, "linked.md"));
        createdSymlink = true;
      } catch {
        createdSymlink = false;
      }

      let createdHardlink = false;
      try {
        await link(join(prdDir, "source.md"), join(prdDir, "linked-hard.md"));
        createdHardlink = true;
      } catch {
        createdHardlink = false;
      }

      const payload = await listPrds(root);
      const docs = payload.prds[0]?.docs ?? [];
      if (createdHardlink) {
        expect(docs).not.toContain("source");
      } else {
        expect(docs).toContain("source");
      }
      if (createdSymlink) {
        expect(docs).not.toContain("linked");
      }
      if (createdHardlink) {
        expect(docs).not.toContain("linked-hard");
      }
    });
  });

  test("reads git branch from .git directory", async () => {
    const projectRoot = await createTempDir("pgch-project");
    const tasksRoot = join(projectRoot, ".tasks");
    await mkdir(tasksRoot, { recursive: true });
    await createPrd(tasksRoot, "alpha");

    const gitDir = join(projectRoot, ".git");
    await mkdir(gitDir, { recursive: true });
    await writeFile(join(gitDir, "HEAD"), "ref: refs/heads/main\n", "utf8");

    try {
      const payload = await listPrds(tasksRoot);
      expect(payload.meta.gitBranch).toBe("main");
    } finally {
      await removeTempDir(projectRoot);
    }
  });

  test("handles gitdir file that points to missing git directory", async () => {
    const projectRoot = await createTempDir("pgch-project");
    const tasksRoot = join(projectRoot, ".tasks");
    await mkdir(tasksRoot, { recursive: true });
    await createPrd(tasksRoot, "alpha");
    await writeFile(join(projectRoot, ".git"), "gitdir: missing/.git\n", "utf8");

    try {
      const payload = await listPrds(tasksRoot);
      expect(payload.meta.gitBranch).toBeNull();
    } finally {
      await removeTempDir(projectRoot);
    }
  });

  test("handles unresolved .git symlink when possible", async () => {
    const projectRoot = await createTempDir("pgch-project");
    const tasksRoot = join(projectRoot, ".tasks");
    await mkdir(tasksRoot, { recursive: true });
    await createPrd(tasksRoot, "alpha");

    let createdSymlink = false;
    try {
      await symlink(join(projectRoot, "missing-git"), join(projectRoot, ".git"));
      createdSymlink = true;
    } catch {
      createdSymlink = false;
    }

    try {
      const payload = await listPrds(tasksRoot);
      if (createdSymlink) {
        expect(payload.meta.gitBranch).toBeNull();
      }
    } finally {
      await removeTempDir(projectRoot);
    }
  });
});

describe("listRoots", () => {
  test("lists roots with PRDs", async () => {
    await withTempConfig(async ({ tasksRoot, configPath }) => {
      await createPrd(tasksRoot, "alpha");
      const payload = await listRoots(configPath);
      expect(payload.roots[0]?.prds[0]?.id).toBe("alpha");
      expect(payload.roots[0]?.id).toBeTruthy();
    });
  });

  test("uses per-root tasksDir override", async () => {
    const projectRoot = await createTempDir("pgch-root");
    const altRoot = await createTempDir("pgch-root-alt");
    const tasksRoot = join(projectRoot, ".tasks");
    const altTasksRoot = join(altRoot, ".tasks-prd");
    await mkdir(tasksRoot, { recursive: true });
    await mkdir(altTasksRoot, { recursive: true });
    await createPrd(tasksRoot, "alpha");
    await createPrd(altTasksRoot, "beta");
    const configDir = await createTempDir("pgch-config");
    const configPath = join(configDir, "config.jsonc");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          tasksDir: ".tasks",
          roots: [{ path: projectRoot }, { path: altRoot, tasksDir: ".tasks-prd" }],
        },
        null,
        2,
      ),
      "utf8",
    );
    try {
      const payload = await listRoots(configPath);
      const prdIds = payload.roots.flatMap((root) => root.prds.map((prd) => prd.id));
      expect(prdIds).toEqual(["alpha", "beta"]);
    } finally {
      await removeTempDir(projectRoot);
      await removeTempDir(altRoot);
      await removeTempDir(configDir);
    }
  });
});

describe("readPlanByRoot", () => {
  test("reads plan for a root id", async () => {
    await withTempConfig(async ({ tasksRoot, configPath }) => {
      await createPrd(tasksRoot, "alpha", { planMarkdown: "# Plan Alpha" });
      const listPayload = await listRoots(configPath);
      const rootId = listPayload.roots[0]?.id;
      const payload = await readPlanByRoot(rootId, "alpha", configPath);
      expect(payload.planMarkdown).toContain("Plan Alpha");
    });
  });

  test("throws for unknown root id", async () => {
    await withTempConfig(async ({ configPath }) => {
      try {
        await readPlanByRoot("missing", "alpha", configPath);
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TasksError);
        const err = error as TasksError;
        expect(err.code).toBe("invalid_root");
      }
    });
  });
});

describe("readMarkdownByRoot", () => {
  test("reads markdown for a root id", async () => {
    await withTempConfig(async ({ tasksRoot, configPath }) => {
      await createPrd(tasksRoot, "alpha", {
        docs: [{ name: "notes.md", content: "# Notes" }],
      });
      const listPayload = await listRoots(configPath);
      const rootId = listPayload.roots[0]?.id;
      const payload = await readMarkdownByRoot(rootId, "alpha", "notes", configPath);
      expect(payload.markdown).toContain("# Notes");
    });
  });
});

describe("readPlan", () => {
  test("returns plan markdown and json text", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha", {
        planMarkdown: "# Plan Alpha",
        planJson: { tasks: [] },
      });

      const payload = await readPlan(root, "alpha");
      expect(payload.planMarkdown).toContain("Plan Alpha");
      expect(payload.planJsonText).toContain('"tasks"');
    });
  });

  test("throws when plan.json is missing", async () => {
    await withTempRoot(async (root) => {
      const prdDir = join(root, "missing-json");
      await mkdir(prdDir, { recursive: true });
      await writeFile(join(prdDir, "plan.md"), "# Plan", "utf8");

      try {
        await readPlan(root, "missing-json");
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TasksError);
        const err = error as TasksError;
        expect(err.code).toBe("not_found");
        expect(err.status).toBe(404);
      }
    });
  });

  test("throws when PRD does not exist", async () => {
    await withTempRoot(async (root) => {
      try {
        await readPlan(root, "missing-prd");
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TasksError);
        const err = error as TasksError;
        expect(err.code).toBe("not_found");
      }
    });
  });

  test("throws when tasks root is missing", async () => {
    const missingRoot = join(await createTempDir("pgch-missing"), "absent");
    try {
      await readPlan(missingRoot, "alpha");
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(TasksError);
      const err = error as TasksError;
      expect(err.code).toBe("not_found");
    } finally {
      await removeTempDir(join(missingRoot, ".."));
    }
  });

  test("tolerates rapid plan.json replacement", async () => {
    await withTempRoot(async (root) => {
      const prdDir = await createPrd(root, "swap", {
        planJson: { tasks: [{ passes: false }] },
      });
      const planPath = join(prdDir, "plan.json");
      const replace = writeFile(planPath, JSON.stringify({ tasks: [{ passes: true }] }), "utf8");
      try {
        const payload = await readPlan(root, "swap");
        expect(payload.planJsonText.length).toBeGreaterThan(0);
      } catch (error) {
        if (error instanceof TasksError) {
          expect(error.code).toBe("not_found");
          expect(error.status).toBe(404);
        } else {
          throw error;
        }
      } finally {
        await replace.catch(() => {});
      }
    });
  });
});

describe("readMarkdown", () => {
  test("returns markdown for a valid doc", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha", {
        docs: [{ name: "notes.md", content: "# Notes" }],
      });

      const payload = await readMarkdown(root, "alpha", "notes");
      expect(payload.markdown).toContain("# Notes");
    });
  });

  test("throws when markdown doc is missing", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha");
      try {
        await readMarkdown(root, "alpha", "missing");
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TasksError);
        const err = error as TasksError;
        expect(err.code).toBe("not_found");
      }
    });
  });

  test("rejects invalid doc IDs", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha");
      const invalid = [
        "",
        " ",
        ".",
        "..",
        "plan",
        "bad..",
        "trail ",
        "trail.",
        "bad/evil",
        "bad\\evil",
        `bad\u0000evil`,
        "con",
        "aux",
        "lpt1",
        "com1",
        "a".repeat(121),
      ];

      for (const id of invalid) {
        try {
          await readMarkdown(root, "alpha", id);
          throw new Error("expected to throw");
        } catch (error) {
          expect(error).toBeInstanceOf(TasksError);
          const err = error as TasksError;
          expect(err.code).toBe("invalid_doc");
          expect(err.status).toBe(400);
        }
      }
    });
  });

  test("rejects symlinked markdown when possible", async () => {
    await withTempRoot(async (root) => {
      const prdDir = await createPrd(root, "alpha");
      const target = join(prdDir, "target.md");
      await writeFile(target, "# Target", "utf8");

      let createdSymlink = false;
      try {
        await symlink(target, join(prdDir, "link.md"));
        createdSymlink = true;
      } catch {
        createdSymlink = false;
      }

      if (!createdSymlink) return;

      try {
        await readMarkdown(root, "alpha", "link");
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(TasksError);
        const err = error as TasksError;
        expect(err.code).toBe("not_found");
        expect(err.status).toBe(404);
      }
    });
  });
});
