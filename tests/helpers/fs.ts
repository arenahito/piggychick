import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type PrdDocSpec = {
  name: string;
  content?: string;
};

export type PrdFixtureOptions = {
  planMarkdown?: string;
  planJson?: unknown;
  planJsonText?: string;
  docs?: PrdDocSpec[];
};

export const createTempDir = async (prefix: string) => {
  return mkdtemp(join(tmpdir(), `${prefix}-`));
};

export const removeTempDir = async (dir: string) => {
  await rm(dir, { recursive: true, force: true });
};

export const createPrd = async (root: string, name: string, options: PrdFixtureOptions = {}) => {
  const prdDir = join(root, name);
  await mkdir(prdDir, { recursive: true });

  const planMarkdown = options.planMarkdown ?? "# Plan";
  await writeFile(join(prdDir, "plan.md"), planMarkdown, "utf8");

  if (options.planJsonText !== undefined) {
    await writeFile(join(prdDir, "plan.json"), options.planJsonText, "utf8");
  } else if (options.planJson !== undefined) {
    await writeFile(join(prdDir, "plan.json"), JSON.stringify(options.planJson), "utf8");
  } else {
    await writeFile(join(prdDir, "plan.json"), JSON.stringify({ tasks: [] }), "utf8");
  }

  if (options.docs) {
    for (const doc of options.docs) {
      await writeFile(join(prdDir, doc.name), doc.content ?? "# Doc", "utf8");
    }
  }

  return prdDir;
};
