import { describe, expect, test } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPrd, createTempDir, removeTempDir } from "../helpers/fs";
import { startServer } from "../../src/server/app";

describe("startServer", () => {
  test("serves static files and API routes", async () => {
    const tasksRoot = await createTempDir("pgch-tasks");
    const distRoot = await createTempDir("pgch-dist");
    const assetsDir = join(distRoot, "assets");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await writeFile(join(assetsDir, "app.js"), "console.log('app');", "utf8");
    await createPrd(tasksRoot, "alpha");

    const { server, port } = await startServer({
      tasksRoot,
      distRoot,
      port: 0,
      openBrowser: false
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

      const apiResponse = await fetch(`${base}/api/prds`);
      expect(apiResponse.status).toBe(200);
      const payload = await apiResponse.json();
      expect(payload.prds[0]?.id).toBe("alpha");
    } finally {
      await server.stop();
      await removeTempDir(tasksRoot);
      await removeTempDir(distRoot);
    }
  });

  test("serves fallback index when index.html is missing", async () => {
    const tasksRoot = await createTempDir("pgch-tasks");
    const distRoot = await createTempDir("pgch-dist");
    await createPrd(tasksRoot, "alpha");

    const { server, port } = await startServer({
      tasksRoot,
      distRoot,
      port: 0,
      openBrowser: false
    });

    try {
      const response = await fetch(`http://localhost:${port}/`);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Build the client");
    } finally {
      await server.stop();
      await removeTempDir(tasksRoot);
      await removeTempDir(distRoot);
    }
  });

  test("serves index when requesting a directory", async () => {
    const tasksRoot = await createTempDir("pgch-tasks");
    const distRoot = await createTempDir("pgch-dist");
    const assetsDir = join(distRoot, "assets");
    await mkdir(assetsDir, { recursive: true });
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await createPrd(tasksRoot, "alpha");

    const { server, port } = await startServer({
      tasksRoot,
      distRoot,
      port: 0,
      openBrowser: false
    });

    try {
      const response = await fetch(`http://localhost:${port}/assets`);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Index");
    } finally {
      await server.stop();
      await removeTempDir(tasksRoot);
      await removeTempDir(distRoot);
    }
  });

  test("rejects requests outside dist root", async () => {
    const tasksRoot = await createTempDir("pgch-tasks");
    const distRoot = await createTempDir("pgch-dist");
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await createPrd(tasksRoot, "alpha");

    const { server, port } = await startServer({
      tasksRoot,
      distRoot,
      port: 0,
      openBrowser: false
    });

    try {
      const drive = process.cwd().slice(0, 2);
      const response = await fetch(`http://localhost:${port}/${drive}/outside.txt`);
      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain("Not Found");
    } finally {
      await server.stop();
      await removeTempDir(tasksRoot);
      await removeTempDir(distRoot);
    }
  });

  test("returns octet-stream for unknown extensions", async () => {
    const tasksRoot = await createTempDir("pgch-tasks");
    const distRoot = await createTempDir("pgch-dist");
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await writeFile(join(distRoot, "data.unknown"), "blob", "utf8");
    await createPrd(tasksRoot, "alpha");

    const { server, port } = await startServer({
      tasksRoot,
      distRoot,
      port: 0,
      openBrowser: false
    });

    try {
      const response = await fetch(`http://localhost:${port}/data.unknown`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    } finally {
      await server.stop();
      await removeTempDir(tasksRoot);
      await removeTempDir(distRoot);
    }
  });

  test("rejects files that resolve outside dist root when possible", async () => {
    const tasksRoot = await createTempDir("pgch-tasks");
    const distRoot = await createTempDir("pgch-dist");
    await writeFile(join(distRoot, "index.html"), "<!doctype html><div>Index</div>", "utf8");
    await createPrd(tasksRoot, "alpha");

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
      tasksRoot,
      distRoot,
      port: 0,
      openBrowser: false
    });

    try {
      if (!createdSymlink) return;
      const response = await fetch(`http://localhost:${port}/outside.txt`);
      expect(response.status).toBe(404);
    } finally {
      await server.stop();
      await removeTempDir(tasksRoot);
      await removeTempDir(distRoot);
      await removeTempDir(outsideDir);
    }
  });
});
