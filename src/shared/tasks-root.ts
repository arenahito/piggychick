import { resolve } from "node:path";

export const resolveTasksRootFromEnv = (fallback: string) => {
  const raw = process.env.PGCH_TASKS_ROOT;
  const value = raw ? raw.trim() : "";
  if (!value) return fallback;
  return resolve(process.cwd(), value);
};
