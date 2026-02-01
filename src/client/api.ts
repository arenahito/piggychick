export type PrdProgress = "not_started" | "in_progress" | "done";

export type PrdSummary = {
  id: string;
  label: string;
  docs: string[];
  progress: PrdProgress;
  worktree?: { id: string; label: string };
};

export type PrdListMeta = {
  rootLabel: string;
  gitBranch: string | null;
  rootPath: string;
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

export type PlanPayload = {
  planMarkdown: string;
  planJsonText: string;
};

export type MarkdownPayload = {
  markdown: string;
};

export type ConfigPayload = {
  path: string;
  text: string;
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }
  if (data === null) {
    throw new Error("Invalid JSON response");
  }
  return data as T;
};

export const fetchRoots = () => fetchJson<RootsPayload>("/api/roots?prdSort=desc");

export const addRoot = (path: string) =>
  fetchJson<RootsPayload>("/api/roots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

export const removeRoot = (rootId: string) =>
  fetchJson<RootsPayload>(`/api/roots/${encodeURIComponent(rootId)}`, { method: "DELETE" });

export const fetchPlan = (rootId: string, prd: string) =>
  fetchJson<PlanPayload>(
    `/api/roots/${encodeURIComponent(rootId)}/prds/${encodeURIComponent(prd)}/plan`,
  );

export const fetchMarkdown = (rootId: string, prd: string, docId: string) =>
  fetchJson<MarkdownPayload>(
    `/api/roots/${encodeURIComponent(rootId)}/prds/${encodeURIComponent(prd)}/${encodeURIComponent(docId)}`,
  );

export const fetchConfig = () => fetchJson<ConfigPayload>("/api/config");

export const saveConfig = (text: string) =>
  fetchJson<ConfigPayload>("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
