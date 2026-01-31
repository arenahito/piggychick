import { afterEach, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolveTasksRootFromEnv } from "../../src/shared/tasks-root";

const envKey = "PGCH_TASKS_ROOT";
const originalValue = process.env[envKey];

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env[envKey];
  } else {
    process.env[envKey] = originalValue;
  }
});

describe("resolveTasksRootFromEnv", () => {
  test("returns fallback when env is unset", () => {
    delete process.env[envKey];
    const fallback = "/tmp/fallback";
    expect(resolveTasksRootFromEnv(fallback)).toBe(fallback);
  });

  test("returns fallback when env is whitespace", () => {
    process.env[envKey] = "   ";
    const fallback = "/tmp/fallback";
    expect(resolveTasksRootFromEnv(fallback)).toBe(fallback);
  });

  test("resolves relative path from cwd", () => {
    process.env[envKey] = "relative/tasks";
    const expected = resolve(process.cwd(), "relative/tasks");
    expect(resolveTasksRootFromEnv("/tmp/fallback")).toBe(expected);
  });
});
