import { constants } from "node:fs";
import { lstat, open, readFile, readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";

export type PrdSummary = {
  id: string;
  label: string;
  docs: string[];
  progress: PrdProgress;
};

export type PrdProgress = "not_started" | "in_progress" | "done";

export type PrdListMeta = {
  rootLabel: string;
  gitBranch: string | null;
  rootPath: string;
};

export type PrdListPayload = {
  meta: PrdListMeta;
  prds: PrdSummary[];
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
  "lpt9"
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

const resolveGitDir = async (projectRoot: string) => {
  const dotGit = resolve(projectRoot, ".git");
  const initialStats = await lstat(dotGit).catch(() => null);
  if (!initialStats) return null;

  let targetPath = dotGit;
  let stats = initialStats;
  if (stats.isSymbolicLink()) {
    const resolved = await realpath(dotGit).catch(() => null);
    if (!resolved) return null;
    targetPath = resolved;
    stats = await lstat(resolved).catch(() => null);
    if (!stats) return null;
  }

  if (stats.isDirectory()) return targetPath;
  if (!stats.isFile()) return null;

  const contents = await readFile(targetPath, "utf8").catch(() => null);
  if (!contents) return null;
  const firstLine = contents.split(/\r?\n/)[0]?.trim();
  if (!firstLine) return null;
  const match = firstLine.match(/^gitdir:\s*(.+)$/i);
  if (!match) return null;
  const gitdirValue = match[1].trim();
  if (!gitdirValue) return null;
  return resolve(dirname(targetPath), gitdirValue);
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

const isSafePrd = (prd: string) => {
  if (prd.length === 0 || prd === "." || prd === "..") return false;
  if (prd.trim().length === 0) return false;
  if (prd !== prd.trim()) return false;
  if (prd.includes("..")) return false;
  if (prd.includes("/") || prd.includes("\\")) return false;
  if (prd.includes("\0")) return false;
  if (/[. ]$/.test(prd)) return false;
  const lowered = prd.toLowerCase();
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
      const passes = typeof task === "object" && task !== null && "passes" in task
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
      if (!resolvedAfter || (!resolvedAfter.startsWith(baseDir + sep) && resolvedAfter !== baseDir)) {
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

export const listPrds = async (root: string): Promise<PrdListPayload> => {
  const rootReal = await realpath(root).catch(() => resolve(root));
  const projectRoot = dirname(rootReal);
  const rootLabel = resolveRootLabel(projectRoot);
  const gitBranch = await resolveGitBranch(projectRoot).catch(() => null);
  const entries = await readDirEntries(rootReal);
  const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

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
    docs.sort((a, b) => collator.compare(a, b));
    const dedupedDocs = docs.filter((docId, index, list) => {
      const key = docId.toLowerCase();
      return list.findIndex((candidate) => candidate.toLowerCase() === key) === index;
    });

    results.push({
      id: entry.name,
      label: entry.name,
      docs: dedupedDocs,
      progress
    });
  }

  return {
    meta: { rootLabel, gitBranch, rootPath: projectRoot },
    prds: results.sort((a, b) => a.label.localeCompare(b.label))
  };
};

export const readPlan = async (root: string, prd: string) => {
  const prdDir = await resolvePrdDir(root, prd);
  const planMarkdown = await readTextFileWithin(prdDir, "plan.md");
  const planJsonText = await readTextFileWithin(prdDir, "plan.json");
  return { planMarkdown, planJsonText };
};

export const readMarkdown = async (root: string, prd: string, docId: string) => {
  const prdDir = await resolvePrdDir(root, prd);
  if (!isSafeDocId(docId)) {
    throw new TasksError("invalid_doc", 400, "Invalid document");
  }
  const markdown = await readTextFileWithin(prdDir, `${docId}.md`);
  return { markdown };
};
