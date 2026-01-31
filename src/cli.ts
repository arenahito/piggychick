import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { startServerWithConfig } from "./server/startup";
import {
  ConfigError,
  loadConfigFile,
  normalizeConfig,
  resolveConfigPath,
  saveConfigFile,
  tasksDirExists,
  toConfigFile,
} from "./shared/config";

const normalizeRootPath = async (value: string) => {
  const resolved = resolve(process.cwd(), value);
  const real = await realpath(resolved).catch(() => null);
  return real ?? resolved;
};

const listRoots = async () => {
  const configPath = resolveConfigPath();
  const config = await loadConfigFile(configPath);
  const normalized = await normalizeConfig(config, { path: configPath });
  for (const root of normalized.roots) {
    console.log(root.path);
  }
};

const addRoot = async (inputPath: string | undefined) => {
  const configPath = resolveConfigPath();
  const config = await loadConfigFile(configPath);
  const normalized = await normalizeConfig(config, { path: configPath });
  const targetPath = await normalizeRootPath(inputPath ?? process.cwd());
  const exists = normalized.roots.some(
    (root) => root.path.toLowerCase() === targetPath.toLowerCase(),
  );
  if (exists) {
    return;
  }
  const hasTasksDir = await tasksDirExists(targetPath, normalized.tasksDir);
  if (!hasTasksDir) {
    throw new ConfigError(
      "config_invalid",
      `Missing tasks directory: ${resolve(targetPath, normalized.tasksDir)}`,
    );
  }
  const updated = {
    tasksDir: normalized.tasksDir,
    roots: [...normalized.roots, { path: targetPath, tasksDir: normalized.tasksDir }],
  };
  await saveConfigFile(toConfigFile(updated), configPath);
};

const removeRoot = async (inputPath: string | undefined) => {
  const configPath = resolveConfigPath();
  const config = await loadConfigFile(configPath);
  const normalized = await normalizeConfig(config, { path: configPath });
  const targetPath = await normalizeRootPath(inputPath ?? process.cwd());
  const remaining = normalized.roots.filter(
    (root) => root.path.toLowerCase() !== targetPath.toLowerCase(),
  );
  if (remaining.length === normalized.roots.length) {
    return;
  }
  await saveConfigFile(
    toConfigFile({ tasksDir: normalized.tasksDir, roots: remaining }),
    configPath,
  );
};

const showConfigPath = () => {
  console.log(resolveConfigPath());
};

const start = async () => {
  await startServerWithConfig();
};

const isCommand = (value: string | undefined, expected: string) => value === expected;

export const runCli = async (overrides: { args?: string[] } = {}) => {
  const args = overrides.args ?? process.argv.slice(2);
  const [command, ...rest] = args;
  if (!command) {
    await start();
    return;
  }
  if (isCommand(command, "list")) {
    await listRoots();
    return;
  }
  if (isCommand(command, "add")) {
    await addRoot(rest[0]);
    return;
  }
  if (isCommand(command, "remove")) {
    await removeRoot(rest[0]);
    return;
  }
  if (isCommand(command, "config")) {
    showConfigPath();
    return;
  }
  console.error(`Unknown command: ${command}`);
  process.exit(1);
};

if (import.meta.main) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
