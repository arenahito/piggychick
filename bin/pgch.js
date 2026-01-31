#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(currentFile), "..");
const distRoot = resolve(packageRoot, "dist");

const ensureDistRoot = (root) => {
  try {
    const stats = lstatSync(root);
    if (stats.isDirectory()) return;
  } catch {}
  console.error(`dist root was not found: ${root}. Run \`bun run build\` in the package directory.`);
  process.exit(1);
};

const ensureBun = () => {
  const result = spawnSync("bun", ["--version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    console.error("Bun is required to run PiggyChick. Install Bun from https://bun.sh");
    process.exit(1);
  }
};

const runWithBun = async () => {
  ensureDistRoot(distRoot);
  const { runCli } = await import("../src/cli.ts");
  await runCli();
};

const runWithNode = () => {
  ensureDistRoot(distRoot);
  ensureBun();
  const cliPath = resolve(packageRoot, "src/cli.ts");
  const child = spawn("bun", [cliPath, ...process.argv.slice(2)], {
    stdio: "inherit"
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", () => process.exit(1));
};

const isBun = typeof process.versions?.bun === "string";

if (isBun) {
  runWithBun().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
} else {
  runWithNode();
}
