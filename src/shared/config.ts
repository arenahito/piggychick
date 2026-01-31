import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseJsonc } from "./jsonc";

export type RootConfigEntry = {
  path: string;
  tasksDir?: string;
};

export type ConfigFile = {
  roots?: RootConfigEntry[];
  tasksDir?: string;
};

export type NormalizedRoot = {
  path: string;
  tasksDir: string;
  tasksDirOverride?: string;
};

export type NormalizedConfig = {
  roots: NormalizedRoot[];
  tasksDir: string;
};

export class ConfigError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const reservedDeviceNames = new Set([
  "con",
  "conin$",
  "conout$",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

const defaultTasksDir = ".tasks";

export const resolveConfigPath = () => {
  return join(homedir(), ".config", "piggychick", "config.jsonc");
};

export const normalizeTasksDir = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return defaultTasksDir;
  if (!isSafeDirName(raw)) {
    throw new ConfigError("config_invalid", `Invalid tasksDir: ${raw}`);
  }
  return raw;
};

export const loadConfigFile = async (path = resolveConfigPath()): Promise<ConfigFile> => {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") {
      return { roots: [], tasksDir: defaultTasksDir };
    }
    const detail = code ? ` (${code})` : "";
    throw new ConfigError("config_read_error", `Failed to read config: ${path}${detail}`);
  }

  if (!text.trim()) {
    return { roots: [], tasksDir: defaultTasksDir };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonc(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid JSONC";
    throw new ConfigError("config_parse_error", `Failed to parse config ${path}: ${detail}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigError("config_invalid", `Invalid config object: ${path}`);
  }

  const obj = parsed as { roots?: unknown; tasksDir?: unknown };
  if (obj.roots !== undefined && !Array.isArray(obj.roots)) {
    throw new ConfigError("config_invalid", `Invalid roots array in ${path}`);
  }
  if (obj.tasksDir !== undefined && typeof obj.tasksDir !== "string") {
    throw new ConfigError("config_invalid", `Invalid tasksDir in ${path}`);
  }

  return {
    roots: obj.roots as RootConfigEntry[] | undefined,
    tasksDir: obj.tasksDir as string | undefined,
  };
};

export const normalizeConfig = async (
  config: ConfigFile,
  options: { cwd?: string; path?: string } = {},
): Promise<NormalizedConfig> => {
  const cwd = options.cwd ?? process.cwd();
  const configPath = options.path ?? resolveConfigPath();
  let globalTasksDir = defaultTasksDir;
  try {
    globalTasksDir = normalizeTasksDir(config.tasksDir);
  } catch (error) {
    if (error instanceof ConfigError) {
      throw new ConfigError(error.code, `${error.message} (${configPath})`);
    }
    throw error;
  }
  const rawRoots = config.roots ?? [];

  const seen = new Set<string>();
  const roots: NormalizedRoot[] = [];

  for (const entry of rawRoots) {
    if (!entry || typeof entry !== "object") {
      throw new ConfigError("config_invalid", `Invalid root entry in ${configPath}`);
    }

    const pathValue = "path" in entry && typeof entry.path === "string" ? entry.path.trim() : "";
    if (!pathValue) {
      throw new ConfigError("config_invalid", `Root path is required in ${configPath}`);
    }

    const resolvedPath = resolve(cwd, pathValue);
    const real = await realpath(resolvedPath).catch(() => null);
    const normalizedPath = real ?? resolvedPath;
    const key = normalizedPath.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const overrideRaw =
      "tasksDir" in entry && typeof entry.tasksDir === "string" ? entry.tasksDir.trim() : "";
    let tasksDirOverride: string | undefined;
    if (overrideRaw) {
      try {
        tasksDirOverride = normalizeTasksDir(overrideRaw);
      } catch (error) {
        if (error instanceof ConfigError) {
          throw new ConfigError(error.code, `${error.message} (${configPath})`);
        }
        throw error;
      }
    }

    roots.push({
      path: normalizedPath,
      tasksDir: tasksDirOverride ?? globalTasksDir,
      tasksDirOverride,
    });
  }

  return { roots, tasksDir: globalTasksDir };
};

export const saveConfigFile = async (config: ConfigFile, path = resolveConfigPath()) => {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const payload: ConfigFile = {
    tasksDir: normalizeTasksDir(config.tasksDir),
    roots: config.roots ?? [],
  };
  const text = `// PiggyChick config\n${JSON.stringify(payload, null, 2)}\n`;
  try {
    await writeFile(path, text, "utf8");
  } catch {
    throw new ConfigError("config_write_error", `Failed to write config: ${path}`);
  }
};

export const toConfigFile = (config: NormalizedConfig): ConfigFile => {
  return {
    tasksDir: config.tasksDir,
    roots: config.roots.map((root) =>
      root.tasksDirOverride
        ? { path: root.path, tasksDir: root.tasksDirOverride }
        : { path: root.path },
    ),
  };
};

export const resolveTasksDirPath = (rootPath: string, tasksDir: string) => {
  return resolve(rootPath, tasksDir);
};

export const tasksDirExists = async (rootPath: string, tasksDir: string) => {
  const candidate = resolveTasksDirPath(rootPath, tasksDir);
  const stats = await lstat(candidate).catch(() => null);
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) return false;
  return true;
};

const isSafeDirName = (name: string) => {
  if (!name) return false;
  if (name.trim().length === 0) return false;
  if (name === "." || name === "..") return false;
  if (name.includes("..")) return false;
  if (name.includes(":")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.includes("\0")) return false;
  if (/[. ]$/.test(name)) return false;
  const lowered = name.toLowerCase();
  const deviceBase = lowered.split(".")[0];
  if (reservedDeviceNames.has(deviceBase)) return false;
  return true;
};
