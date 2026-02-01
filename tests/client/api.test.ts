import { afterEach, describe, expect, test } from "bun:test";
import {
  addRoot,
  fetchConfig,
  fetchMarkdown,
  fetchPlan,
  fetchRoots,
  removeRoot,
  saveConfig,
} from "../../src/client/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("api helpers", () => {
  test("fetches roots, plan, markdown, and config", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/roots") && !url.includes("/api/roots/")) {
        return new Response(
          JSON.stringify({
            roots: [
              {
                id: "root",
                path: "/",
                tasksDir: ".tasks",
                meta: { rootLabel: "", gitBranch: null, rootPath: "/" },
                prds: [],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/api/config")) {
        return new Response(JSON.stringify({ path: "/config.jsonc", text: "{}" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/plan")) {
        return new Response(
          JSON.stringify({ planMarkdown: "# Plan", planJsonText: '{"tasks":[]}' }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ markdown: "# Notes" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const roots = await fetchRoots();
    expect(Array.isArray(roots.roots)).toBe(true);

    const plan = await fetchPlan("root", "alpha");
    expect(plan.planMarkdown).toContain("Plan");

    const doc = await fetchMarkdown("root", "alpha", "notes");
    expect(doc.markdown).toContain("Notes");

    const config = await fetchConfig();
    expect(config.path).toContain("config");
  });

  test("adds and removes roots", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(JSON.stringify({ roots: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await addRoot("/tmp/project");
    await removeRoot("root");
    expect(calls).toContain("POST /api/roots");
    expect(calls).toContain("DELETE /api/roots/root");
  });

  test("saves config text", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(JSON.stringify({ path: "/config.jsonc", text: "{}" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    await saveConfig("{}");
    expect(calls).toContain("PUT /api/config");
  });

  test("throws message from error payload", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Nope" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    try {
      await fetchRoots();
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Nope");
    }
  });

  test("falls back to status message when JSON is invalid", async () => {
    globalThis.fetch = async () => new Response("nope", { status: 500 });

    try {
      await fetchRoots();
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Request failed: 500");
    }
  });

  test("propagates fetch errors", async () => {
    globalThis.fetch = async () => {
      throw new Error("network");
    };

    try {
      await fetchRoots();
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("network");
    }
  });
});
