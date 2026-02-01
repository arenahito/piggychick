import { describe, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { startServerWithConfig } from "../../src/server/startup";
import { createTempDir, removeTempDir } from "../helpers/fs";

describe("startServerWithConfig", () => {
  test("creates config file when missing", async () => {
    const tempRoot = await createTempDir("pgch-startup");
    const configDir = join(tempRoot, "config");
    const configPath = join(configDir, "config.jsonc");
    const distRoot = join(tempRoot, "dist");
    await mkdir(distRoot, { recursive: true });
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");

    const { server } = await startServerWithConfig({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      const text = await readFile(configPath, "utf8");
      expect(text).toContain("\"tasksDir\": \".tasks\"");
      expect(text).toContain("\"roots\": []");
    } finally {
      await server.stop();
      await removeTempDir(tempRoot);
    }
  });
});
