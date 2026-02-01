import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import {
  loadConfigFile,
  normalizeConfig,
  resolveConfigPath,
  resolveTasksDirPath,
  type NormalizedRoot,
} from "../shared/config";

export type PrdSummary = {
  id: string;
  label: string;
  docs: string[];
  progress: PrdProgress;
  worktree?: { id: string; label: string };
};

export type PrdProgress = "not_started" | "in_progress" | "done";
export type PrdSortOrder = "asc" | "desc";

export type PrdListMeta = {
  rootLabel: string;
  gitBranch: string | null;
  rootPath: string;
};

export type PrdListPayload = {
  meta: PrdListMeta;
  prds: PrdSummary[];
};

export type RootSummary = {
  id: string;
  path: string;
  tasksDir: string;
  meta: PrdListMeta;
  prds: PrdSummary[];
};

export type RootsPayload = {
  roots: RootSummary[];
};

type WorktreeInfo = {
  id: string;
  path: string;
  label: string;
};

type GitInfo = {
  gitDir: string | null;
  isWorktree: boolean;
};

export class TasksError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
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

const resolveRootLabel = (projectRoot: string) => {
  let rootLabel = basename(projectRoot);
  if (!rootLabel) {
    const trimmed = projectRoot.replace(/[\\/]+$/, "");
    rootLabel = basename(trimmed);
  }
  if (!rootLabel) {
    rootLabel = "root";
  }
  return rootLabel;
};

const buildRootId = (rootPath: string) => {
  return createHash("sha1").update(rootPath).digest("hex").slice(0, 12);
};

const buildWorktreeId = (worktreePath: string) => {
  return buildRootId(worktreePath);
};

const resolveRootDirName = (projectRoot: string) => {
  let name = basename(projectRoot);
  if (!name) {
    const trimmed = projectRoot.replace(/[\\/]+$/, "");
    name = basename(trimmed);
  }
  return name;
};

const normalizeWorktreeLabel = (rootDirName: string, worktreeDirName: string) => {
  let label = worktreeDirName;
  if (rootDirName) {
    const loweredRoot = rootDirName.toLowerCase();
    if (label.toLowerCase().startsWith(loweredRoot)) {
      label = label.slice(rootDirName.length);
    }
  }
  const trimmed = label.replace(/^[^A-Za-z0-9]+/, "");
  return trimmed || worktreeDirName;
};

const parseGitDirLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^gitdir:\s*(.+)$/i);
  const value = match ? match[1].trim() : trimmed;
  return value || null;
};

const resolveGitDirFromFile = (targetPath: string, contents: string) => {
  const firstLine = contents.split(/\r?\n/)[0] ?? "";
  const gitdirValue = parseGitDirLine(firstLine);
  if (!gitdirValue) return null;
  return resolve(dirname(targetPath), gitdirValue);
};

const isWorktreeGitDir = (gitDir: string) => {
  const parts = gitDir.split(/[\\/]+/).filter(Boolean);
  const lowered = parts.map((part) => part.toLowerCase());
  for (let index = 0; index < lowered.length - 1; index += 1) {
    if (lowered[index] === ".git" && lowered[index + 1] === "worktrees") {
      return true;
    }
  }
  return false;
};

const encodeWorktreePrdId = (worktreeId: string, prdId: string) => {
  return `wt:${worktreeId}:${prdId}`;
};

const isValidWorktreeId = (value: string) => {
  return /^[a-f0-9]{12}$/i.test(value);
};

type PrdIdentity = {
  prdId: string;
  worktreeId: string | null;
};

const parsePrdIdentity = (prdParam: string): PrdIdentity | null => {
  if (!prdParam.startsWith("wt:")) {
    return { prdId: prdParam, worktreeId: null };
  }
  const rest = prdParam.slice(3);
  const separator = rest.indexOf(":");
  if (separator <= 0 || separator >= rest.length - 1) {
    return null;
  }
  const worktreeId = rest.slice(0, separator);
  const prdId = rest.slice(separator + 1);
  if (!isValidWorktreeId(worktreeId)) {
    return null;
  }
  return { prdId, worktreeId };
};

const buildRootEntries = (roots: NormalizedRoot[]) => {
  const counts = new Map<string, number>();
  return roots.map((root) => {
    const baseId = buildRootId(root.path);
    const count = counts.get(baseId) ?? 0;
    counts.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count}`;
    return { id, root };
  });
};

const resolveGitInfo = async (projectRoot: string): Promise<GitInfo> => {
  const dotGit = resolve(projectRoot, ".git");
  const initialStats = await lstat(dotGit).catch(() => null);
  if (!initialStats) return { gitDir: null, isWorktree: false };

  let targetPath = dotGit;
  let stats = initialStats;
  if (stats.isSymbolicLink()) {
    const resolved = await realpath(dotGit).catch(() => null);
    if (!resolved) return { gitDir: null, isWorktree: false };
    targetPath = resolved;
    const resolvedStats = await lstat(resolved).catch(() => null);
    if (!resolvedStats) return { gitDir: null, isWorktree: false };
    stats = resolvedStats;
  }

  if (stats.isDirectory()) {
    return { gitDir: targetPath, isWorktree: false };
  }
  if (!stats.isFile()) return { gitDir: null, isWorktree: false };

  const contents = await readFile(targetPath, "utf8").catch(() => null);
  if (!contents) return { gitDir: null, isWorktree: false };
  const resolvedGitDir = resolveGitDirFromFile(targetPath, contents);
  if (!resolvedGitDir) return { gitDir: null, isWorktree: false };
  const isWorktree = isWorktreeGitDir(resolvedGitDir);
  return { gitDir: resolvedGitDir, isWorktree };
};

const resolveGitDir = async (projectRoot: string) => {
  const info = await resolveGitInfo(projectRoot);
  return info.gitDir;
};

const resolveGitBranch = async (projectRoot: string) => {
  const gitDir = await resolveGitDir(projectRoot);
  if (!gitDir) return null;
  const headPath = resolve(gitDir, "HEAD");
  const headText = await readFile(headPath, "utf8").catch(() => null);
  if (!headText) return null;
  const line = headText.trim();
  const match = line.match(/^ref:\s*(.+)$/i);
  if (!match) return null;
  const ref = match[1].trim();
  const prefix = "refs/heads/";
  if (!ref.startsWith(prefix)) return null;
  const branch = ref.slice(prefix.length).trim();
  return branch || null;
};

const listGitWorktrees = async (projectRoot: string, gitDir: string): Promise<WorktreeInfo[]> => {
  const worktreesDir = join(gitDir, "worktrees");
  const entries = await readdir(worktreesDir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];

  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  const projectRootReal = await realpath(projectRoot).catch(() => resolve(projectRoot));
  const rootDirName = resolveRootDirName(projectRootReal);
  const results: WorktreeInfo[] = [];
  const seen = new Set<string>();
  const sortedEntries = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => ({
      name: String(entry.name),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));

  for (const { name } of sortedEntries) {
    const gitdirFile = join(worktreesDir, name, "gitdir");
    const gitdirText = await readFile(gitdirFile, "utf8").catch(() => null);
    if (!gitdirText) continue;
    const resolvedGitdir = resolveGitDirFromFile(gitdirFile, gitdirText);
    if (!resolvedGitdir) continue;
    const gitdirStats = await lstat(resolvedGitdir).catch(() => null);
    if (!gitdirStats || gitdirStats.isSymbolicLink()) continue;
    const worktreeRoot = dirname(resolvedGitdir);
    if (!(await dirExists(worktreeRoot))) continue;
    const worktreeReal = await realpath(worktreeRoot).catch(() => null);
    if (!worktreeReal) continue;
    if (worktreeReal === projectRootReal) continue;
    const key = worktreeReal.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const worktreeDirName = basename(worktreeReal) || basename(worktreeRoot);
    const label = normalizeWorktreeLabel(rootDirName, worktreeDirName || worktreeReal);
    results.push({ id: buildWorktreeId(worktreeReal), path: worktreeReal, label });
  }

  return results;
};

const isSafePrd = (prd: string) => {
  if (prd.length === 0 || prd === "." || prd === "..") return false;
  if (prd.trim().length === 0) return false;
  if (prd !== prd.trim()) return false;
  if (prd.includes("..")) return false;
  if (prd.includes(":")) return false;
  if (prd.includes("/") || prd.includes("\\")) return false;
  if (prd.includes("\0")) return false;
  if (/[. ]$/.test(prd)) return false;
  const lowered = prd.toLowerCase();
  if (lowered.startsWith("wt:")) return false;
  const deviceBase = lowered.split(".")[0];
  if (reservedDeviceNames.has(deviceBase)) return false;
  return true;
};

const isSafeDocId = (docId: string) => {
  if (docId.length === 0 || docId.length > 120) return false;
  if (docId.trim().length === 0) return false;
  if (docId !== docId.trim()) return false;
  if (docId === "." || docId === "..") return false;
  if (docId.includes("..")) return false;
  if (docId.includes("/") || docId.includes("\\")) return false;
  if (docId.includes("\0")) return false;
  if (/[. ]$/.test(docId)) return false;
  const lowered = docId.toLowerCase();
  const deviceBase = lowered.split(".")[0];
  if (reservedDeviceNames.has(deviceBase)) return false;
  if (lowered === "plan") return false;
  return true;
};

const fileExists = async (path: string) => {
  const stats = await lstat(path).catch(() => null);
  if (!stats) return false;
  if (stats.isSymbolicLink()) return false;
  if (!stats.isFile()) return false;
  if (stats.nlink > 1) return false;
  return true;
};

const dirExists = async (path: string) => {
  const stats = await lstat(path).catch(() => null);
  if (!stats) return false;
  if (stats.isSymbolicLink()) return false;
  if (!stats.isDirectory()) return false;
  return true;
};

const openReadHandle = async (path: string) => {
  if (typeof constants.O_NOFOLLOW === "number") {
    try {
      return await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "ENOTSUP" && code !== "EINVAL" && code !== "EOPNOTSUPP" && code !== "ENOSYS") {
        return null;
      }
    }
  }

  return open(path, "r").catch(() => null);
};

const readDirEntries = async (path: string) => {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOENT") return [];
    throw new TasksError("io_error", 500, "Failed to read directory");
  }
};

const computeProgress = (planJsonText: string): PrdProgress => {
  try {
    const parsed = JSON.parse(planJsonText) as { tasks?: unknown };
    if (!parsed || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return "not_started";
    }
    let allTrue = true;
    let allFalse = true;
    for (const task of parsed.tasks) {
      const passes =
        typeof task === "object" && task !== null && "passes" in task
          ? (task as { passes?: unknown }).passes === true
          : false;
      if (passes) {
        allFalse = false;
      } else {
        allTrue = false;
      }
    }
    if (allTrue) return "done";
    if (allFalse) return "not_started";
    return "in_progress";
  } catch {
    return "not_started";
  }
};

const resolveFilePath = async (baseDir: string, filename: string) => {
  const candidate = resolve(baseDir, filename);
  const candidateStats = await lstat(candidate).catch(() => null);
  if (!candidateStats || candidateStats.isSymbolicLink() || !candidateStats.isFile()) {
    throw new TasksError("not_found", 404, "Document not found");
  }
  const resolved = await realpath(candidate).catch(() => null);
  if (!resolved || (!resolved.startsWith(baseDir + sep) && resolved !== baseDir)) {
    throw new TasksError("not_found", 404, "Document not found");
  }
  return resolved;
};

const readTextFileWithin = async (baseDir: string, filename: string) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const resolved = await resolveFilePath(baseDir, filename);
    const before = await lstat(resolved).catch(() => null);
    if (!before || before.isSymbolicLink() || !before.isFile()) {
      throw new TasksError("not_found", 404, "Document not found");
    }
    const handle = await openReadHandle(resolved);
    if (!handle) {
      throw new TasksError("not_found", 404, "Document not found");
    }
    try {
      const resolvedAfter = await realpath(resolved).catch(() => null);
      if (
        !resolvedAfter ||
        (!resolvedAfter.startsWith(baseDir + sep) && resolvedAfter !== baseDir)
      ) {
        throw new TasksError("not_found", 404, "Document not found");
      }
      const stats = await handle.stat();
      if (!stats.isFile()) {
        throw new TasksError("not_found", 404, "Document not found");
      }
      if (before.nlink > 1 || stats.nlink > 1) {
        throw new TasksError("not_found", 404, "Document not found");
      }
      if (before.dev !== stats.dev || before.ino !== stats.ino) {
        if (attempt === 0) continue;
        throw new TasksError("not_found", 404, "Document not found");
      }
      return await handle.readFile({ encoding: "utf8" });
    } finally {
      await handle.close();
    }
  }
  throw new TasksError("not_found", 404, "Document not found");
};

const resolvePrdDir = async (root: string, prd: string) => {
  if (!isSafePrd(prd)) {
    throw new TasksError("invalid_prd", 400, "Invalid PRD id");
  }

  const rootReal = await realpath(root).catch(() => resolve(root));
  const prdDir = resolve(rootReal, prd);
  if (!prdDir.startsWith(rootReal + sep) && prdDir !== rootReal) {
    throw new TasksError("invalid_prd", 400, "Invalid PRD id");
  }

  const stats = await lstat(prdDir).catch(() => null);
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new TasksError("not_found", 404, "PRD not found");
  }

  const prdReal = await realpath(prdDir).catch(() => null);
  if (!prdReal || (!prdReal.startsWith(rootReal + sep) && prdReal !== rootReal)) {
    throw new TasksError("invalid_prd", 400, "Invalid PRD id");
  }

  return prdReal;
};

const collectPrds = async (
  root: string,
  options: { collator: Intl.Collator; worktree?: WorktreeInfo },
): Promise<PrdSummary[]> => {
  const rootReal = await realpath(root).catch(() => resolve(root));
  if (!(await dirExists(rootReal))) return [];
  const entries = await readDirEntries(rootReal);
  const results: PrdSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (!isSafePrd(entry.name)) continue;

    const prdDir = resolve(rootReal, entry.name);
    if (!prdDir.startsWith(rootReal + sep) && prdDir !== rootReal) continue;

    const prdReal = await realpath(prdDir).catch(() => null);
    if (!prdReal || (!prdReal.startsWith(rootReal + sep) && prdReal !== rootReal)) continue;

    const planMd = join(prdReal, "plan.md");
    const planJson = join(prdReal, "plan.json");
    const hasPlanMd = await fileExists(planMd);
    const hasPlanJson = await fileExists(planJson);
    if (!hasPlanMd || !hasPlanJson) continue;

    let progress: PrdProgress = "not_started";
    try {
      const planJsonText = await readTextFileWithin(prdReal, "plan.json");
      progress = computeProgress(planJsonText);
    } catch {
      progress = "not_started";
    }

    const docEntries = await readDirEntries(prdReal);
    const docs: string[] = [];
    for (const docEntry of docEntries) {
      if (!docEntry.isFile() || docEntry.isSymbolicLink()) continue;
      const name = docEntry.name;
      if (!name.toLowerCase().endsWith(".md")) continue;
      if (name.toLowerCase() === "plan.md") continue;
      const docId = name.slice(0, -3);
      if (docId.toLowerCase() === "plan") continue;
      if (!isSafeDocId(docId)) continue;
      const docPath = join(prdReal, name);
      const stats = await lstat(docPath).catch(() => null);
      if (!stats || stats.isSymbolicLink() || !stats.isFile()) continue;
      if (stats.nlink > 1) continue;
      docs.push(docId);
    }
    docs.sort((a, b) => options.collator.compare(a, b));
    const dedupedDocs = docs.filter((docId, index, list) => {
      const key = docId.toLowerCase();
      return list.findIndex((candidate) => candidate.toLowerCase() === key) === index;
    });

    results.push({
      id: options.worktree ? encodeWorktreePrdId(options.worktree.id, entry.name) : entry.name,
      label: entry.name,
      docs: dedupedDocs,
      progress,
      worktree: options.worktree
        ? { id: options.worktree.id, label: options.worktree.label }
        : undefined,
    });
  }

  return results;
};

export const listPrds = async (
  root: string,
  options: { sortOrder?: PrdSortOrder } = {},
): Promise<PrdListPayload> => {
  const rootReal = await realpath(root).catch(() => resolve(root));
  const projectRoot = dirname(rootReal);
  const rootLabel = resolveRootLabel(projectRoot);
  const gitBranch = await resolveGitBranch(projectRoot).catch(() => null);
  const gitInfo = await resolveGitInfo(projectRoot).catch(() => ({
    gitDir: null,
    isWorktree: false,
  }));
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
  const sortOrder: PrdSortOrder = options.sortOrder === "desc" ? "desc" : "asc";

  const results: PrdSummary[] = [];
  results.push(...(await collectPrds(rootReal, { collator })));
  if (gitInfo.gitDir && !gitInfo.isWorktree) {
    const tasksDirName = basename(rootReal);
    let worktrees: WorktreeInfo[] = [];
    try {
      worktrees = await listGitWorktrees(projectRoot, gitInfo.gitDir);
    } catch {
      worktrees = [];
    }
    for (const worktree of worktrees) {
      const tasksRoot = resolve(worktree.path, tasksDirName);
      try {
        const prds = await collectPrds(tasksRoot, { collator, worktree });
        results.push(...prds);
      } catch {
        continue;
      }
    }
  }
  const comparePrds = (a: PrdSummary, b: PrdSummary) => {
    const labelCompare = collator.compare(a.label, b.label);
    if (labelCompare !== 0) return labelCompare;
    const worktreeLabelA = a.worktree?.label ?? "";
    const worktreeLabelB = b.worktree?.label ?? "";
    const worktreeLabelCompare = collator.compare(worktreeLabelA, worktreeLabelB);
    if (worktreeLabelCompare !== 0) return worktreeLabelCompare;
    const worktreeIdA = a.worktree?.id ?? "";
    const worktreeIdB = b.worktree?.id ?? "";
    return collator.compare(worktreeIdA, worktreeIdB);
  };

  return {
    meta: { rootLabel, gitBranch, rootPath: projectRoot },
    prds:
      sortOrder === "desc"
        ? results.sort((a, b) => comparePrds(b, a))
        : results.sort((a, b) => comparePrds(a, b)),
  };
};

export const listRoots = async (
  configPath = resolveConfigPath(),
  options: { sortOrder?: PrdSortOrder } = {},
): Promise<RootsPayload> => {
  const config = await loadConfigFile(configPath);
  const normalized = await normalizeConfig(config, { path: configPath });
  const entries = buildRootEntries(normalized.roots);
  const roots: RootSummary[] = [];
  for (const entry of entries) {
    const tasksRoot = resolveTasksDirPath(entry.root.path, entry.root.tasksDir);
    const payload = await listPrds(tasksRoot, options);
    roots.push({
      id: entry.id,
      path: entry.root.path,
      tasksDir: entry.root.tasksDir,
      meta: payload.meta,
      prds: payload.prds,
    });
  }
  return { roots };
};

export const resolveRootById = async (rootId: string, configPath = resolveConfigPath()) => {
  const config = await loadConfigFile(configPath);
  const normalized = await normalizeConfig(config, { path: configPath });
  const entries = buildRootEntries(normalized.roots);
  const match = entries.find((entry) => entry.id === rootId);
  return match?.root ?? null;
};

const resolveTasksRootForPrd = async (root: NormalizedRoot, identity: PrdIdentity) => {
  if (!identity.worktreeId) {
    return resolveTasksDirPath(root.path, root.tasksDir);
  }
  const gitInfo = await resolveGitInfo(root.path).catch(() => ({
    gitDir: null,
    isWorktree: false,
  }));
  if (!gitInfo.gitDir || gitInfo.isWorktree) {
    throw new TasksError("not_found", 404, "PRD not found");
  }
  const worktrees = await listGitWorktrees(root.path, gitInfo.gitDir);
  const match = worktrees.find((worktree) => worktree.id === identity.worktreeId);
  if (!match) {
    throw new TasksError("not_found", 404, "PRD not found");
  }
  return resolveTasksDirPath(match.path, root.tasksDir);
};

export const readPlanByRoot = async (rootId: string, prd: string, configPath?: string) => {
  const root = await resolveRootById(rootId, configPath);
  if (!root) {
    throw new TasksError("invalid_root", 404, "Root not found");
  }
  const identity = parsePrdIdentity(prd);
  if (!identity) {
    throw new TasksError("not_found", 404, "PRD not found");
  }
  const tasksRoot = await resolveTasksRootForPrd(root, identity);
  return readPlan(tasksRoot, identity.prdId);
};

export const readMarkdownByRoot = async (
  rootId: string,
  prd: string,
  docId: string,
  configPath?: string,
) => {
  const root = await resolveRootById(rootId, configPath);
  if (!root) {
    throw new TasksError("invalid_root", 404, "Root not found");
  }
  const identity = parsePrdIdentity(prd);
  if (!identity) {
    throw new TasksError("not_found", 404, "PRD not found");
  }
  const tasksRoot = await resolveTasksRootForPrd(root, identity);
  return readMarkdown(tasksRoot, identity.prdId, docId);
};

export const readPlan = async (root: string, prd: string) => {
  const prdDir = await resolvePrdDir(root, prd);
  const planMarkdown = await readTextFileWithin(prdDir, "plan.md");
  const planJsonText = await readTextFileWithin(prdDir, "plan.json");
  return { planMarkdown, planJsonText, prdPath: prdDir };
};

export const readMarkdown = async (root: string, prd: string, docId: string) => {
  const prdDir = await resolvePrdDir(root, prd);
  if (!isSafeDocId(docId)) {
    throw new TasksError("invalid_doc", 400, "Invalid document");
  }
  const markdown = await readTextFileWithin(prdDir, `${docId}.md`);
  return { markdown };
};
