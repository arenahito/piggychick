import { describe, expect, test } from "bun:test";
import { createPrd, createTempDir, removeTempDir } from "../helpers/fs";
import { handleApiRequest } from "../../src/server/routes";

const withTempRoot = async (fn: (root: string) => Promise<void>) => {
  const root = await createTempDir("pgch-tasks");
  try {
    await fn(root);
  } finally {
    await removeTempDir(root);
  }
};

describe("handleApiRequest", () => {
  test("rejects non-GET methods", async () => {
    await withTempRoot(async (root) => {
      const request = new Request("http://localhost/api/prds", { method: "POST" });
      const response = await handleApiRequest(request, root);
      expect(response.status).toBe(405);
      const payload = await response.json();
      expect(payload.error?.code).toBe("method_not_allowed");
    });
  });

  test("returns PRD list payload", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha");
      const request = new Request("http://localhost/api/prds");
      const response = await handleApiRequest(request, root);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(Array.isArray(payload.prds)).toBe(true);
      expect(payload.prds[0]?.id).toBe("alpha");
      expect(payload.meta?.rootPath).toBeTruthy();
    });
  });

  test("returns TasksError for invalid PRD id", async () => {
    await withTempRoot(async (root) => {
      const request = new Request("http://localhost/api/prds/bad../plan");
      const response = await handleApiRequest(request, root);
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.code).toBe("invalid_prd");
    });
  });

  test("returns plan payload", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha", {
        planMarkdown: "# Plan Alpha",
        planJson: { tasks: [] }
      });
      const request = new Request("http://localhost/api/prds/alpha/plan");
      const response = await handleApiRequest(request, root);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.planMarkdown).toContain("Plan Alpha");
      expect(payload.planJsonText).toContain("\"tasks\"");
    });
  });

  test("returns markdown payload", async () => {
    await withTempRoot(async (root) => {
      await createPrd(root, "alpha", {
        docs: [{ name: "notes.md", content: "# Notes" }]
      });
      const request = new Request("http://localhost/api/prds/alpha/notes");
      const response = await handleApiRequest(request, root);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.markdown).toContain("# Notes");
    });
  });

  test("returns not found for unknown route", async () => {
    await withTempRoot(async (root) => {
      const request = new Request("http://localhost/api/unknown");
      const response = await handleApiRequest(request, root);
      expect(response.status).toBe(404);
      const payload = await response.json();
      expect(payload.error?.code).toBe("not_found");
    });
  });
});
