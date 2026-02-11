import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPrd, createTempDir, removeTempDir } from "../helpers/fs";
import {
  emitSyntheticRootChangeForTests,
  getRootEventsDebugSnapshot,
  resetRootEventsForTests,
} from "../../src/server/prd-events";
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

const readChangedEvent = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs = 5000,
) => {
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const result = await Promise.race([
      reader.read(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), remaining)),
    ]);
    if (result === null) {
      throw new Error("Timed out waiting for SSE event");
    }
    if (result.done) {
      throw new Error("SSE stream closed");
    }
    buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/g, "\n");
    while (true) {
      const separator = buffer.indexOf("\n\n");
      if (separator < 0) break;
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const lines = frame.split("\n");
      let eventName = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          data += line.slice("data:".length).trim();
        }
      }
      if (eventName !== "changed" || data.length === 0) continue;
      return JSON.parse(data) as { kind: string; rootId: string; prdId: string | null; at: string };
    }
  }
  throw new Error("Timed out waiting for SSE event");
};

const readChangedEventWithin = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
) => {
  try {
    return await readChangedEvent(reader, timeoutMs);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timed out")) {
      return null;
    }
    throw error;
  }
};

const waitFor = async (predicate: () => boolean, timeoutMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(20);
  }
  throw new Error("Timed out waiting for condition");
};

afterEach(() => {
  resetRootEventsForTests();
});

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

  test("sorts PRDs descending with prdSort=DESC", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha");
      await createPrd(join(root, ".tasks"), "beta");
      const request = new Request("http://localhost/api/roots?prdSort=DESC");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      const prdIds = payload.roots[0]?.prds.map((prd: { id: string }) => prd.id);
      expect(prdIds).toEqual(["beta", "alpha"]);
    });
  });

  test("sorts PRDs descending with whitespace around prdSort", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha");
      await createPrd(join(root, ".tasks"), "beta");
      const request = new Request("http://localhost/api/roots?prdSort=%20DESC%20");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      const prdIds = payload.roots[0]?.prds.map((prd: { id: string }) => prd.id);
      expect(prdIds).toEqual(["beta", "alpha"]);
    });
  });

  test("falls back to ascending order for invalid prdSort", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha");
      await createPrd(join(root, ".tasks"), "beta");
      const request = new Request("http://localhost/api/roots?prdSort=sideways");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      const prdIds = payload.roots[0]?.prds.map((prd: { id: string }) => prd.id);
      expect(prdIds).toEqual(["alpha", "beta"]);
    });
  });

  test("applies prdSort to POST /api/roots responses", async () => {
    await withTempRoot(async (root, configPath) => {
      await createPrd(join(root, ".tasks"), "alpha");
      await createPrd(join(root, ".tasks"), "beta");
      const extraRoot = await createTempDir("pgch-extra");
      const extraTasks = join(extraRoot, ".tasks");
      await mkdir(extraTasks, { recursive: true });
      await createPrd(extraTasks, "gamma");
      try {
        const request = new Request("http://localhost/api/roots?prdSort=DESC", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: extraRoot }),
        });
        const response = await handleApiRequest(request, configPath);
        expect(response.status).toBe(200);
        const payload = await response.json();
        const targetRoot = payload.roots.find(
          (entry: { meta?: { rootPath?: string } }) => entry.meta?.rootPath === root,
        );
        const prdIds = targetRoot?.prds.map((prd: { id: string }) => prd.id);
        expect(prdIds).toEqual(["beta", "alpha"]);
      } finally {
        await removeTempDir(extraRoot);
      }
    });
  });

  test("applies prdSort to DELETE /api/roots responses", async () => {
    await withTempRoot(async (root, configPath) => {
      const extraRoot = await createTempDir("pgch-extra");
      const extraTasks = join(extraRoot, ".tasks");
      await mkdir(extraTasks, { recursive: true });
      await createPrd(extraTasks, "alpha");
      await createPrd(extraTasks, "beta");
      try {
        const addRequest = new Request("http://localhost/api/roots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: extraRoot }),
        });
        const addResponse = await handleApiRequest(addRequest, configPath);
        expect(addResponse.status).toBe(200);
        const listRequest = new Request("http://localhost/api/roots");
        const listResponse = await handleApiRequest(listRequest, configPath);
        const listPayload = await listResponse.json();
        const rootId = listPayload.roots.find(
          (entry: { meta?: { rootPath?: string } }) => entry.meta?.rootPath === root,
        )?.id;
        const deleteRequest = new Request(`http://localhost/api/roots/${rootId}?prdSort=DESC`, {
          method: "DELETE",
        });
        const deleteResponse = await handleApiRequest(deleteRequest, configPath);
        expect(deleteResponse.status).toBe(200);
        const deletePayload = await deleteResponse.json();
        const remainingRoot = deletePayload.roots.find(
          (entry: { meta?: { rootPath?: string } }) => entry.meta?.rootPath === extraRoot,
        );
        const prdIds = remainingRoot?.prds.map((prd: { id: string }) => prd.id);
        expect(prdIds).toEqual(["beta", "alpha"]);
      } finally {
        await removeTempDir(extraRoot);
      }
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

  test("returns config payload", async () => {
    await withTempRoot(async (_root, configPath) => {
      const request = new Request("http://localhost/api/config");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.path).toBe(configPath);
      expect(typeof payload.text).toBe("string");
    });
  });

  test("saves config updates", async () => {
    await withTempRoot(async (_root, configPath) => {
      const text = JSON.stringify({ tasksDir: ".tasks", roots: [] }, null, 2);
      const request = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.text).toBe(text);
      const saved = await readFile(configPath, "utf8");
      expect(saved).toBe(text);
    });
  });

  test("rejects invalid config text without writing", async () => {
    await withTempRoot(async (_root, configPath) => {
      const before = await readFile(configPath, "utf8");
      const request = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "{" }),
      });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.code).toBe("config_parse_error");
      const after = await readFile(configPath, "utf8");
      expect(after).toBe(before);
    });
  });

  test("rejects invalid config schema without writing", async () => {
    await withTempRoot(async (_root, configPath) => {
      const before = await readFile(configPath, "utf8");
      const text = JSON.stringify({ tasksDir: 123, roots: [] }, null, 2);
      const request = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.code).toBe("config_invalid");
      const after = await readFile(configPath, "utf8");
      expect(after).toBe(before);
    });
  });

  test("rejects invalid root tasksDir override without writing", async () => {
    await withTempRoot(async (_root, configPath) => {
      const before = await readFile(configPath, "utf8");
      const text = JSON.stringify({ tasksDir: ".tasks", roots: [{ path: "/tmp", tasksDir: 1 }] });
      const request = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.code).toBe("config_invalid");
      const after = await readFile(configPath, "utf8");
      expect(after).toBe(before);
    });
  });

  test("rejects non-string config text", async () => {
    await withTempRoot(async (_root, configPath) => {
      const request = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: 42 }),
      });
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.code).toBe("invalid_body");
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

  test("streams root change events with inferred prd id", async () => {
    await withTempRoot(async (root, configPath) => {
      const tasksRoot = join(root, ".tasks");
      await createPrd(tasksRoot, "alpha");
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id as string;
      const controller = new AbortController();
      const eventsRequest = new Request(`http://localhost/api/roots/${rootId}/events`, {
        method: "GET",
        signal: controller.signal,
      });
      const eventsResponse = await handleApiRequest(eventsRequest, configPath);
      expect(eventsResponse.status).toBe(200);
      expect(eventsResponse.headers.get("Content-Type")).toContain("text/event-stream");
      expect(eventsResponse.headers.get("Cache-Control")).toBe("no-cache");
      expect(eventsResponse.headers.get("Connection")).toBe("keep-alive");
      expect(eventsResponse.headers.get("X-Accel-Buffering")).toBe("no");
      const reader = eventsResponse.body?.getReader();
      if (!reader) throw new Error("Missing SSE stream body");

      await writeFile(
        join(tasksRoot, "alpha", "plan.json"),
        JSON.stringify({ tasks: [{ status: "done" }] }),
        "utf8",
      );
      const event = await readChangedEvent(reader);
      expect(event.kind).toBe("changed");
      expect(event.rootId).toBe(rootId);
      expect(event.prdId).toBe("alpha");
      expect(typeof event.at).toBe("string");
      controller.abort();
      await reader.cancel().catch(() => {});
    });
  });

  test("returns invalid_root for unknown root events endpoint", async () => {
    await withTempRoot(async (_root, configPath) => {
      const request = new Request("http://localhost/api/roots/missing/events");
      const response = await handleApiRequest(request, configPath);
      expect(response.status).toBe(404);
      const payload = await response.json();
      expect(payload.error?.code).toBe("invalid_root");
    });
  });

  test("coalesces burst changes and emits null prdId for multi-prd updates", async () => {
    await withTempRoot(async (root, configPath) => {
      const tasksRoot = join(root, ".tasks");
      await createPrd(tasksRoot, "alpha");
      await createPrd(tasksRoot, "beta");
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id as string;
      const controller = new AbortController();
      const eventsRequest = new Request(`http://localhost/api/roots/${rootId}/events`, {
        method: "GET",
        signal: controller.signal,
      });
      const eventsResponse = await handleApiRequest(eventsRequest, configPath);
      const reader = eventsResponse.body?.getReader();
      if (!reader) throw new Error("Missing SSE stream body");

      const emittedAlpha = emitSyntheticRootChangeForTests(rootId, "alpha/plan.json");
      const emittedBeta = emitSyntheticRootChangeForTests(rootId, "beta/plan.json");
      expect(emittedAlpha).toBe(true);
      expect(emittedBeta).toBe(true);

      const event = await readChangedEvent(reader);
      expect(event.rootId).toBe(rootId);
      expect(event.prdId).toBeNull();
      const extra = await readChangedEventWithin(reader, 350);
      expect(extra).toBeNull();
      controller.abort();
      await reader.cancel().catch(() => {});
    });
  });

  test("releases watcher resources after stream cancellation", async () => {
    await withTempRoot(async (root, configPath) => {
      const tasksRoot = join(root, ".tasks");
      await createPrd(tasksRoot, "alpha");
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id as string;
      const controller = new AbortController();
      const eventsRequest = new Request(`http://localhost/api/roots/${rootId}/events`, {
        method: "GET",
        signal: controller.signal,
      });
      const eventsResponse = await handleApiRequest(eventsRequest, configPath);
      const reader = eventsResponse.body?.getReader();
      if (!reader) throw new Error("Missing SSE stream body");
      await waitFor(() => getRootEventsDebugSnapshot().subscribers > 0);
      controller.abort();
      await reader.cancel().catch(() => {});
      await waitFor(() => getRootEventsDebugSnapshot().subscribers === 0);
      await waitFor(() => getRootEventsDebugSnapshot().roots === 0);
    });
  });

  test("does not retain subscribers for already-aborted events requests", async () => {
    await withTempRoot(async (root, configPath) => {
      const tasksRoot = join(root, ".tasks");
      await createPrd(tasksRoot, "alpha");
      const listRequest = new Request("http://localhost/api/roots");
      const listResponse = await handleApiRequest(listRequest, configPath);
      const listPayload = await listResponse.json();
      const rootId = listPayload.roots[0]?.id as string;
      const controller = new AbortController();
      controller.abort();
      const eventsRequest = new Request(`http://localhost/api/roots/${rootId}/events`, {
        method: "GET",
        signal: controller.signal,
      });
      const eventsResponse = await handleApiRequest(eventsRequest, configPath);
      const reader = eventsResponse.body?.getReader();
      if (reader) {
        await reader.cancel().catch(() => {});
      }
      await waitFor(() => getRootEventsDebugSnapshot().subscribers === 0);
      await waitFor(() => getRootEventsDebugSnapshot().roots === 0);
    });
  });
});
