import { describe, expect, test } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPrd, createTempDir, removeTempDir } from "../helpers/fs";
import { startServer } from "../../src/server/app";

const setupConfig = async (projectRoot: string, tasksDir = ".tasks") => {
  const configDir = await createTempDir("pgch-config");
  const configPath = join(configDir, "config.jsonc");
  await writeFile(
    configPath,
    JSON.stringify({ tasksDir, roots: [{ path: projectRoot }] }, null, 2),
    "utf8",
  );
  return { configDir, configPath };
};

const setupProjectRoot = async () => {
  const projectRoot = await createTempDir("pgch-root");
  const tasksRoot = join(projectRoot, ".tasks");
  await mkdir(tasksRoot, { recursive: true });
  await createPrd(tasksRoot, "alpha");
  return { projectRoot, tasksRoot };
};

describe("startServer", () => {
  test("serves static files and API routes without openBrowser option", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    const { configDir, configPath } = await setupConfig(projectRoot);
    const assetsDir = join(distRoot, "assets");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await writeFile(join(assetsDir, "app.js"), "console.log('app');", "utf8");

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
    });

    try {
      const base = `http://localhost:${port}`;

      const indexResponse = await fetch(`${base}/`);
      expect(indexResponse.status).toBe(200);
      const indexText = await indexResponse.text();
      expect(indexText).toContain("Index");

      const assetResponse = await fetch(`${base}/assets/app.js`);
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("Cache-Control")).toBeTruthy();

      const apiResponse = await fetch(`${base}/api/roots`);
      expect(apiResponse.status).toBe(200);
      const payload = await apiResponse.json();
      expect(payload.roots[0]?.prds[0]?.id).toBe("alpha");
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(configDir);
    }
  });

  test("serves static files and API routes", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    const { configDir, configPath } = await setupConfig(projectRoot);
    const assetsDir = join(distRoot, "assets");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await writeFile(join(assetsDir, "app.js"), "console.log('app');", "utf8");

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      const base = `http://localhost:${port}`;

      const indexResponse = await fetch(`${base}/`);
      expect(indexResponse.status).toBe(200);
      const indexText = await indexResponse.text();
      expect(indexText).toContain("Index");

      const assetResponse = await fetch(`${base}/assets/app.js`);
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("Cache-Control")).toBeTruthy();

      const apiResponse = await fetch(`${base}/api/roots`);
      expect(apiResponse.status).toBe(200);
      const payload = await apiResponse.json();
      expect(payload.roots[0]?.prds[0]?.id).toBe("alpha");
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(configDir);
    }
  });

  test("serves fallback index when index.html is missing", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    const { configDir, configPath } = await setupConfig(projectRoot);

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${port}/`);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Build the client");
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(configDir);
    }
  });

  test("serves index when requesting a directory", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    const assetsDir = join(distRoot, "assets");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    const { configDir, configPath } = await setupConfig(projectRoot);

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${port}/assets`);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Index");
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(configDir);
    }
  });

  test("rejects requests outside dist root", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    const { configDir, configPath } = await setupConfig(projectRoot);

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      const outsidePath = "/%2Ftmp/outside.txt";
      const response = await fetch(`http://localhost:${port}${outsidePath}`);
      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain("Not Found");
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(configDir);
    }
  });

  test("returns octet-stream for unknown extensions", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await writeFile(join(distRoot, "data.unknown"), "blob", "utf8");
    const { configDir, configPath } = await setupConfig(projectRoot);

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      const response = await fetch(`http://localhost:${port}/data.unknown`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(configDir);
    }
  });

  test("rejects files that resolve outside dist root when possible", async () => {
    const { projectRoot } = await setupProjectRoot();
    const distRoot = await createTempDir("pgch-dist");
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    const { configDir, configPath } = await setupConfig(projectRoot);

    const outsideDir = await createTempDir("pgch-outside");
    const outsideFile = join(outsideDir, "outside.txt");
    await writeFile(outsideFile, "outside", "utf8");

    let createdSymlink = false;
    try {
      await symlink(outsideFile, join(distRoot, "outside.txt"));
      createdSymlink = true;
    } catch {
      createdSymlink = false;
    }

    const { server, port } = await startServer({
      configPath,
      distRoot,
      port: 0,
      openBrowser: false,
    });

    try {
      if (!createdSymlink) return;
      const response = await fetch(`http://localhost:${port}/outside.txt`);
      expect(response.status).toBe(404);
    } finally {
      await server.stop();
      await removeTempDir(projectRoot);
      await removeTempDir(distRoot);
      await removeTempDir(outsideDir);
      await removeTempDir(configDir);
    }
  });
});
