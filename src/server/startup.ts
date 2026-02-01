import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import {
  ensureConfigFile,
  loadConfigFile,
  normalizeConfig,
  resolveConfigPath,
} from "../shared/config";
import { resolveDistRoot } from "../shared/paths";
import { startServer } from "./app";

const assertDistRoot = (distRoot: string) => {
  try {
    const stats = lstatSync(distRoot);
    if (!stats.isDirectory()) {
      throw new Error("dist root is not a directory");
    }
  } catch {
    throw new Error(
      `dist root was not found: ${distRoot}. Run \`bun run build\` in the package directory.`,
    );
  }

  const indexPath = resolve(distRoot, "index.html");
  try {
    const stats = lstatSync(indexPath);
    if (!stats.isFile()) {
      throw new Error("missing index.html");
    }
  } catch {
    throw new Error(
      `dist assets were not found: ${indexPath}. Run \`bun run build\` in the package directory.`,
    );
  }
};

export type StartupOptions = {
  configPath?: string;
  distRoot?: string;
  port?: number;
  openBrowser?: boolean;
};

export const startServerWithConfig = async (options: StartupOptions = {}) => {
  const configPath = options.configPath ?? resolveConfigPath();
  await ensureConfigFile(configPath);
  const config = await loadConfigFile(configPath);
  await normalizeConfig(config, { path: configPath });
  const distRoot = resolveDistRoot(options.distRoot);
  assertDistRoot(distRoot);
  return startServer({
    configPath,
    distRoot,
    port: options.port,
    openBrowser: options.openBrowser,
  });
};
