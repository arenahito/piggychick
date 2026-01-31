import { afterEach, describe, expect, test } from "bun:test";
import { fetchMarkdown, fetchPlan, fetchPrds } from "../../src/client/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("api helpers", () => {
  test("fetches PRDs, plan, and markdown", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/prds")) {
        return new Response(
          JSON.stringify({ meta: { rootLabel: "", gitBranch: null, rootPath: "/" }, prds: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/plan")) {
        return new Response(
          JSON.stringify({ planMarkdown: "# Plan", planJsonText: "{\"tasks\":[]}" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ markdown: "# Notes" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    const prds = await fetchPrds();
    expect(Array.isArray(prds.prds)).toBe(true);

    const plan = await fetchPlan("alpha");
    expect(plan.planMarkdown).toContain("Plan");

    const doc = await fetchMarkdown("alpha", "notes");
    expect(doc.markdown).toContain("Notes");
  });

  test("throws message from error payload", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "Nope" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });

    try {
      await fetchPrds();
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Nope");
    }
  });

  test("falls back to status message when JSON is invalid", async () => {
    globalThis.fetch = async () => new Response("nope", { status: 500 });

    try {
      await fetchPrds();
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
      await fetchPrds();
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("network");
    }
  });
});
