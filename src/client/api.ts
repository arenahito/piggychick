export type PrdProgress = "not_started" | "in_progress" | "done";

export type PrdSummary = {
  id: string;
  label: string;
  docs: string[];
  progress: PrdProgress;
};

export type PlanPayload = {
  planMarkdown: string;
  planJsonText: string;
};

export type MarkdownPayload = {
  markdown: string;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
};

export const fetchPrds = () => fetchJson<PrdSummary[]>("/api/prds");

export const fetchPlan = (prd: string) =>
  fetchJson<PlanPayload>(`/api/prds/${encodeURIComponent(prd)}/plan`);

export const fetchMarkdown = (prd: string, docId: string) =>
  fetchJson<MarkdownPayload>(`/api/prds/${encodeURIComponent(prd)}/${encodeURIComponent(docId)}`);
