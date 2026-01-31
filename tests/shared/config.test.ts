import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createTempDir, removeTempDir } from "../helpers/fs";
import {
  ConfigError,
  loadConfigFile,
  normalizeConfig,
  normalizeTasksDir,
  resolveConfigPath,
  saveConfigFile,
} from "../../src/shared/config";

const withTempConfig = async (fn: (path: string) => Promise<void>) => {
  const dir = await createTempDir("pgch-config");
  const path = join(dir, "config.jsonc");
  try {
    await fn(path);
  } finally {
    await removeTempDir(dir);
  }
};

describe("resolveConfigPath", () => {
  test("uses ~/.config/piggychick/config.jsonc", () => {
    const expected = join(homedir(), ".config", "piggychick", "config.jsonc");
    expect(resolveConfigPath()).toBe(expected);
  });
});

describe("loadConfigFile", () => {
  test("returns defaults when file is missing", async () => {
    await withTempConfig(async (path) => {
      const config = await loadConfigFile(path);
      expect(config.tasksDir).toBe(".tasks");
      expect(config.roots).toEqual([]);
    });
  });

  test("parses JSONC with comments and trailing commas", async () => {
    await withTempConfig(async (path) => {
      const jsonc = `// comment\n{\n  "tasksDir": ".tasks",\n  "roots": [\n    { "path": "./alpha", },\n  ],\n}\n`;
      await writeFile(path, jsonc, "utf8");
      const config = await loadConfigFile(path);
      expect(config.tasksDir).toBe(".tasks");
      expect(config.roots?.[0]?.path).toBe("./alpha");
    });
  });

  test("treats comment-only config as empty", async () => {
    await withTempConfig(async (path) => {
      await writeFile(path, "// only comment\n", "utf8");
      const config = await loadConfigFile(path);
      const normalized = await normalizeConfig(config, { path });
      expect(normalized.tasksDir).toBe(".tasks");
      expect(normalized.roots).toEqual([]);
    });
  });

  test("throws on invalid config content", async () => {
    await withTempConfig(async (path) => {
      await writeFile(path, "{ nope }", "utf8");
      try {
        await loadConfigFile(path);
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
      }
    });
  });

  test("rejects array config payloads", async () => {
    await withTempConfig(async (path) => {
      await writeFile(path, "[]", "utf8");
      try {
        await loadConfigFile(path);
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
      }
    });
  });

  test("rejects comment-joined tokens", async () => {
    await withTempConfig(async (path) => {
      await writeFile(path, '{"tasksDir": 1/*c*/2}', "utf8");
      try {
        await loadConfigFile(path);
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
      }
    });
  });
});

describe("normalizeTasksDir", () => {
  test("defaults to .tasks when blank", () => {
    expect(normalizeTasksDir("   ")).toBe(".tasks");
  });

  test("rejects invalid names", () => {
    try {
      normalizeTasksDir("bad/dir");
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
    }
  });

  test("rejects colon paths", () => {
    try {
      normalizeTasksDir("bad:dir");
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
    }
  });
});

describe("normalizeConfig", () => {
  test("applies per-root override", async () => {
    await withTempConfig(async (path) => {
      const config = {
        tasksDir: ".tasks",
        roots: [{ path: "alpha" }, { path: "beta", tasksDir: ".tasks-prd" }],
      };
      const normalized = await normalizeConfig(config, { cwd: process.cwd(), path });
      expect(normalized.roots[0]?.tasksDir).toBe(".tasks");
      expect(normalized.roots[1]?.tasksDir).toBe(".tasks-prd");
    });
  });

  test("dedupes roots case-insensitively", async () => {
    await withTempConfig(async (path) => {
      const config = {
        tasksDir: ".tasks",
        roots: [{ path: "Alpha" }, { path: "alpha" }],
      };
      const normalized = await normalizeConfig(config, { cwd: process.cwd(), path });
      expect(normalized.roots).toHaveLength(1);
    });
  });
});

describe("saveConfigFile", () => {
  test("writes normalized tasksDir", async () => {
    await withTempConfig(async (path) => {
      await saveConfigFile({ roots: [] }, path);
      const config = await loadConfigFile(path);
      expect(config.tasksDir).toBe(".tasks");
    });
  });
});
