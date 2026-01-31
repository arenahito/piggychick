import { describe, expect, test } from "bun:test";
import { normalizeProgress, progressToEmoji, progressToLabel } from "../../src/client/progress";

describe("progress utilities", () => {
  test("normalizeProgress defaults to not_started", () => {
    expect(normalizeProgress(null)).toBe("not_started");
    expect(normalizeProgress(undefined)).toBe("not_started");
    expect(normalizeProgress("in_progress")).toBe("in_progress");
    expect(normalizeProgress("done")).toBe("done");
  });

  test("progressToEmoji returns expected symbols", () => {
    expect(progressToEmoji("not_started")).toBe("⬜");
    expect(progressToEmoji("in_progress")).toBe("🔄");
    expect(progressToEmoji("done")).toBe("✅");
  });

  test("progressToLabel returns expected labels", () => {
    expect(progressToLabel("not_started")).toBe("Not started");
    expect(progressToLabel("in_progress")).toBe("In progress");
    expect(progressToLabel("done")).toBe("Done");
  });
});
