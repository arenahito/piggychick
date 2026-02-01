import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPrd, createTempDir, removeTempDir } from "../helpers/fs";
import { handleApiRequest } from "../../src/server/routes";

const withTempRoot = async (fn: (root: string, configPath: string) => Promise<void>) => {
  const root = await createTempDir("pgch-root");
  const tasksRoot = join(root, ".tasks");
  await mkdir(tasksRoot, { recursive: true });
  const configDir = await createTempDir("pgch-config");
  const configPath = join(configDir, "config.jsonc");
  await writeFile(
    configPath,
    JSON.stringify({ tasksDir: ".tasks", roots: [{ path: root }] }, null, 2),
    "utf8",
  );
  try {
    await fn(root, configPath);
  } finally {
    await removeTempDir(root);
    await removeTempDir(configDir);
  }
};

describe("handleApiRequest", () => {
  test("rejects non-GET methods", async () => {
    await withTempRoot(async (_root, configPath) => {
      const request = new Request("http://localhost/api/roots", { method: "PATCH" });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(405);
      const payload = await response.json();
      expect(payload.error?.code).toBe("method_not_allowed");
    });
  });

  test("returns PRD list payload", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha");
      const request = new Request("http://localhost/api/roots");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(Array.isArray(payload.roots)).toBe(true);
      expect(payload.roots[0]?.prds[0]?.id).toBe("alpha");
      expect(payload.roots[0]?.meta?.rootPath).toBeTruthy();
    });
  });

  test("returns TasksError for invalid PRD id", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha");
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id;
      const request = new Request(`http://localhost/api/roots/${rootId}/prds/bad../plan`);
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.code).toBe("invalid_prd");
    });
  });

  test("returns plan payload", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha", {
        planMarkdown: "# Plan Alpha",
        planJson: { tasks: [] },
      });
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id;
      const request = new Request(`http://localhost/api/roots/${rootId}/prds/alpha/plan`);
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.planMarkdown).toContain("Plan Alpha");
      expect(payload.planJsonText).toContain('"tasks"');
    });
  });

  test("returns markdown payload", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha", {
        docs: [{ name: "notes.md", content: "# Notes" }],
      });
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id;
      const request = new Request(`http://localhost/api/roots/${rootId}/prds/alpha/notes`);
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.markdown).toContain("# Notes");
    });
  });

  test("decodes encoded PRD and doc ids", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha space", {
        docs: [{ name: "notes space.md", content: "# Notes Space" }],
      });
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id;
      const prdId = encodeURIComponent("alpha space");
      const docId = encodeURIComponent("notes space");
      const request = new Request(`http://localhost/api/roots/${rootId}/prds/${prdId}/${docId}`);
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.markdown).toContain("# Notes Space");
    });
  });

  test("returns not found for unknown route", async () => {
    await withTempRoot(async (_root, configPath) => {
      const request = new Request("http://localhost/api/unknown");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(404);
      const payload = await response.json();
      expect(payload.error?.code).toBe("not_found");
    });
  });

  test("adds a root via POST", async () => {
    await withTempRoot(async (_root, configPath) => {
      const extraRoot = await createTempDir("pgch-extra");
      const extraTasks = join(extraRoot, ".tasks");
      await mkdir(extraTasks, { recursive: true });
      await createPrd(extraTasks, "beta");
      try {
        const request = new Request("http://localhost/api/roots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: extraRoot }),
        });
        const response = await handleApiRequest(request, configPath);
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.roots).toHaveLength(2);
      } finally {
        await removeTempDir(extraRoot);
      }
    });
  });

  test("removes a root via DELETE", async () => {
    await withTempRoot(async (_root, configPath) => {
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id;
      const request = new Request(`http://localhost/api/roots/${rootId}`, { method: "DELETE" });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.roots).toHaveLength(0);
    });
  });
});
