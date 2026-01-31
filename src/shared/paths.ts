import { lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hasPackageJson = (dir: string) => {
  try {
    const stats = lstatSync(resolve(dir, "package.json"));
    return stats.isFile();
  } catch {
    return false;
  }
};

export const resolvePackageRoot = () => {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (hasPackageJson(current)) return current;
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
};

export const resolveDistRoot = (override?: string) => {
  if (override) return resolve(override);
  return resolve(resolvePackageRoot(), "dist");
};
