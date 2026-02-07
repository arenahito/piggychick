import { describe, expect, test } from "bun:test";
import { normalizeProgress, progressToIcon, progressToLabel } from "../../src/client/progress";

describe("progress utilities", () => {
  test("normalizeProgress defaults to not_started", () => {
    expect(normalizeProgress(null)).toBe("not_started");
    expect(normalizeProgress(undefined)).toBe("not_started");
    expect(normalizeProgress("in_progress")).toBe("in_progress");
    expect(normalizeProgress("done")).toBe("done");
  });

  test("progressToIcon returns SVG icons for each progress state", () => {
    const makeElement = (tagName: string) => {
      const attributes = new Map<string, string>();
      const children: unknown[] = [];
      return {
        tagName: tagName.toUpperCase(),
        setAttribute(name: string, value: string) {
          attributes.set(name, value);
        },
        getAttribute(name: string) {
          return attributes.get(name) ?? null;
        },
        append(child: unknown) {
          children.push(child);
        },
        children,
      };
    };

    const originalDocument = globalThis.document;
    const fakeDocument = {
      createElementNS(_namespace: string, tagName: string) {
        return makeElement(tagName);
      },
    } as unknown as Document;

    (globalThis as { document?: Document }).document = fakeDocument;
    try {
      const notStarted = progressToIcon("not_started") as unknown as {
        tagName: string;
        getAttribute(name: string): string | null;
        children: unknown[];
      };
      const inProgress = progressToIcon("in_progress") as unknown as {
        tagName: string;
        getAttribute(name: string): string | null;
        children: unknown[];
      };
      const done = progressToIcon("done") as unknown as {
        tagName: string;
        getAttribute(name: string): string | null;
        children: unknown[];
      };

      expect(notStarted.tagName).toBe("SVG");
      expect(inProgress.tagName).toBe("SVG");
      expect(done.tagName).toBe("SVG");
      expect(notStarted.getAttribute("class")).toBe("icon icon--lg");
      expect(inProgress.getAttribute("class")).toBe("icon icon--lg");
      expect(done.getAttribute("class")).toBe("icon icon--lg");
      expect(notStarted.children.length).toBeGreaterThan(0);
      expect(inProgress.children.length).toBeGreaterThan(0);
      expect(done.children.length).toBeGreaterThan(0);
    } finally {
      if (originalDocument) {
        (globalThis as { document?: Document }).document = originalDocument;
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
    }
  });

  test("progressToLabel returns expected labels", () => {
    expect(progressToLabel("not_started")).toBe("Not started");
    expect(progressToLabel("in_progress")).toBe("In progress");
    expect(progressToLabel("done")).toBe("Done");
  });
});
