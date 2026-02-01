import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ConfigError,
  loadConfigFile,
  normalizeConfig,
  resolveConfigPath,
  saveConfigFile,
  tasksDirExists,
  toConfigFile,
} from "../shared/config";
import {
  listRoots,
  readMarkdownByRoot,
  readPlanByRoot,
  resolveRootById,
  TasksError,
} from "./tasks";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const jsonError = (status: number, code: string, message: string) => {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: jsonHeaders,
  });
};

const handleTasksError = (error: unknown) => {
  if (error instanceof TasksError) {
    return jsonError(error.status, error.code, error.message);
  }
  if (error instanceof ConfigError) {
    const status =
      error.code === "config_invalid" || error.code === "config_parse_error" ? 400 : 500;
    return jsonError(status, error.code, error.message);
  }
  return jsonError(500, "internal_error", "Unexpected server error");
};

const normalizeRootPath = async (value: string) => {
  const resolved = resolve(process.cwd(), value);
  const real = await realpath(resolved).catch(() => null);
  return real ?? resolved;
};

const decodeSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const handleApiRequest = async (request: Request, configPath = resolveConfigPath()) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "api") {
    return jsonError(404, "not_found", "Not found");
  }

  if (segments[1] === "roots" && segments.length === 2) {
    if (request.method === "GET") {
      try {
        const payload = await listRoots(configPath);
        return new Response(JSON.stringify(payload), { headers: jsonHeaders });
      } catch (error) {
        return handleTasksError(error);
      }
    }
    if (request.method === "POST") {
      try {
        const body = (await request.json().catch(() => null)) as { path?: unknown } | null;
        const pathValue = typeof body?.path === "string" ? body.path.trim() : "";
        if (!pathValue) {
          return jsonError(400, "invalid_body", "Path is required");
        }
        const config = await loadConfigFile(configPath);
        const normalized = await normalizeConfig(config, { path: configPath });
        const targetPath = await normalizeRootPath(pathValue);
        const exists = normalized.roots.some(
          (root) => root.path.toLowerCase() === targetPath.toLowerCase(),
        );
        if (!exists) {
          const hasTasksDir = await tasksDirExists(targetPath, normalized.tasksDir);
          if (!hasTasksDir) {
            return jsonError(
              400,
              "invalid_root",
              `Missing tasks directory: ${resolve(targetPath, normalized.tasksDir)}`,
            );
          }
          const updated = {
            tasksDir: normalized.tasksDir,
            roots: [...normalized.roots, { path: targetPath, tasksDir: normalized.tasksDir }],
          };
          await saveConfigFile(toConfigFile(updated), configPath);
        }
        const payload = await listRoots(configPath);
        return new Response(JSON.stringify(payload), { headers: jsonHeaders });
      } catch (error) {
        return handleTasksError(error);
      }
    }
    return jsonError(405, "method_not_allowed", "Method not allowed");
  }

  if (segments[1] === "roots" && segments.length === 3) {
    if (request.method === "DELETE") {
      const rootId = decodeSegment(segments[2]);
      if (!rootId) {
        return jsonError(400, "invalid_request", "Invalid root id");
      }
      try {
        const root = await resolveRootById(rootId, configPath);
        if (!root) {
          return jsonError(404, "not_found", "Root not found");
        }
        const config = await loadConfigFile(configPath);
        const normalized = await normalizeConfig(config, { path: configPath });
        const remaining = normalized.roots.filter(
          (entry) => entry.path.toLowerCase() !== root.path.toLowerCase(),
        );
        await saveConfigFile(
          toConfigFile({ tasksDir: normalized.tasksDir, roots: remaining }),
          configPath,
        );
        const payload = await listRoots(configPath);
        return new Response(JSON.stringify(payload), { headers: jsonHeaders });
      } catch (error) {
        return handleTasksError(error);
      }
    }
    return jsonError(405, "method_not_allowed", "Method not allowed");
  }

  if (segments[1] === "roots" && segments[3] === "prds" && segments.length === 6) {
    if (request.method !== "GET") {
      return jsonError(405, "method_not_allowed", "Method not allowed");
    }
    const rootId = decodeSegment(segments[2]);
    const prd = decodeSegment(segments[4]);
    const doc = decodeSegment(segments[5]);
    if (!rootId || !prd || !doc) {
      return jsonError(400, "invalid_request", "Invalid request");
    }
    try {
      if (doc === "plan") {
        const payload = await readPlanByRoot(rootId, prd, configPath);
        return new Response(JSON.stringify(payload), { headers: jsonHeaders });
      }
      const payload = await readMarkdownByRoot(rootId, prd, doc, configPath);
      return new Response(JSON.stringify(payload), { headers: jsonHeaders });
    } catch (error) {
      return handleTasksError(error);
    }
  }

  return jsonError(404, "not_found", "Not found");
};
