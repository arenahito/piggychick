import { lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./server/app";

const resolvePackageRoot = () => {
  const currentFile = fileURLToPath(import.meta.url);
  return resolve(dirname(currentFile), "..");
};

const resolveDistRoot = () => {
  const envRoot = process.env.PGCH_DIST_ROOT;
  if (envRoot && envRoot.trim().length > 0) {
    return resolve(envRoot);
  }
  return resolve(resolvePackageRoot(), "dist");
};

const resolveTasksRoot = (arg?: string) => {
  if (arg) {
    return resolve(arg);
  }
  return resolve(process.cwd(), ".tasks");
};

const assertDistRoot = (distRoot: string) => {
  try {
    const stats = lstatSync(distRoot);
    if (stats.isDirectory()) return;
  } catch {}
  console.error(`dist root was not found: ${distRoot}. Run \`bun run build\` in the package directory.`);
  process.exit(1);
};

export const runCli = async (overrides: { tasksRoot?: string; distRoot?: string } = {}) => {
  const tasksRoot = overrides.tasksRoot ?? resolveTasksRoot(process.argv[2]);
  const distRoot = overrides.distRoot ? resolve(overrides.distRoot) : resolveDistRoot();
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
