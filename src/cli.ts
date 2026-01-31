import { lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./server/app";
import { resolveTasksRootFromEnv } from "./shared/tasks-root";

const resolvePackageRoot = () => {
  const currentFile = fileURLToPath(import.meta.url);
  return resolve(dirname(currentFile), "..");
};

const assertDistRoot = (distRoot: string) => {
  try {
    const stats = lstatSync(distRoot);
    if (stats.isDirectory()) return;
  } catch {}
  console.error(`dist root was not found: ${distRoot}. Run \`bun run build\` in the package directory.`);
  process.exit(1);
};

export const runCli = async (overrides: { tasksRoot?: string } = {}) => {
  const tasksRoot = overrides.tasksRoot ?? resolveTasksRootFromEnv(resolve(process.cwd(), ".tasks"));
  const distRoot = resolve(resolvePackageRoot(), "dist");
  assertDistRoot(distRoot);
  await startServer({ tasksRoot, distRoot });
};

if (import.meta.main) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
