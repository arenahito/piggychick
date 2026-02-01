import { addRoot, fetchMarkdown, fetchPlan, fetchRoots, removeRoot, type RootSummary } from "./api";
import { createLayout } from "./components/layout";
import { renderSidebar, type Selection } from "./components/sidebar";
import { renderPlanView, type MarkdownSection } from "./components/plan-view";
import { renderMarkdown, renderMermaid, setMermaidTheme } from "./renderers/markdown";
import { normalizeProgress, progressToEmoji } from "./progress";
import "./styles.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app element");
}

const layout = createLayout();
root.append(layout.root);

const currentTheme = "dark";
setMermaidTheme("dark");

const state: {
  roots: RootSummary[];
  selection: Selection | null;
  collapsedRoots: Record<string, boolean>;
  lastPlan: { rootId: string; prdId: string; planMarkdown: string; planJsonText: string } | null;
} = {
  roots: [],
  selection: null,
  collapsedRoots: {},
  lastPlan: null,
};

const collapsedRootsKey = "pgch.sidebarCollapsedRoots";
let selectionRequest = 0;

const readCollapsedRoots = () => {
  try {
    const raw = localStorage.getItem(collapsedRootsKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeCollapsedRoots = (value: Record<string, boolean>) => {
  try {
    localStorage.setItem(collapsedRootsKey, JSON.stringify(value));
  } catch {
    return;
  }
};

const parseHash = (): { rootId: string; prdId: string; hasExtra: boolean } | null => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return null;
  const [selectionRaw, ...extraParts] = raw.split("/");
  if (!selectionRaw) return null;
  let decoded = "";
  try {
    decoded = decodeURIComponent(selectionRaw);
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator <= 0 || separator >= decoded.length - 1) return null;
  const rootId = decoded.slice(0, separator);
  const prdId = decoded.slice(separator + 1);
  if (!rootId || !prdId) return null;
  const hasExtra = extraParts.some((part) => part.length > 0);
  return { rootId, prdId, hasExtra };
};

const setHash = (rootId: string, prdId: string) => {
  window.location.hash = `#/${encodeURIComponent(`${rootId}:${prdId}`)}`;
};

const findFirstSelection = (): Selection | null => {
  for (const rootEntry of state.roots) {
    const firstPrd = rootEntry.prds[0];
    if (firstPrd) {
      return { rootId: rootEntry.id, prdId: firstPrd.id };
    }
  }
  return null;
};

const ensureSelection = () => {
  let updatedHash = false;
  const parsed = parseHash();
  if (parsed) {
    const rootEntry = state.roots.find((root) => root.id === parsed.rootId);
    const prd = rootEntry?.prds.find((entry) => entry.id === parsed.prdId);
    if (rootEntry && prd) {
      state.selection = { rootId: rootEntry.id, prdId: prd.id };
      if (parsed.hasExtra) {
        setHash(rootEntry.id, prd.id);
        updatedHash = true;
      }
      return updatedHash;
    }
  }

  const fallback = findFirstSelection();
  if (!fallback) {
    state.selection = null;
    return updatedHash;
  }
  state.selection = fallback;
  setHash(fallback.rootId, fallback.prdId);
  updatedHash = true;
  return updatedHash;
};

const renderEmpty = (message: string) => {
  layout.contentBody.innerHTML = "";
  const note = document.createElement("div");
  note.className = "content-note";
  note.textContent = message;
  layout.contentBody.append(note);
};

const setContentMode = (hasSelection: boolean) => {
  if (hasSelection) {
    layout.content.classList.add("app-content--plan");
  } else {
    layout.content.classList.remove("app-content--plan");
  }
};

const renderContent = (body: string) => {
  layout.contentBody.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "content-markdown markdown-body";
  wrapper.innerHTML = renderMarkdown(body);

  layout.contentBody.append(wrapper);
  void renderMermaid(wrapper);
};

const renderError = (message: string) => {
  layout.contentBody.innerHTML = "";
  const note = document.createElement("div");
  note.className = "content-error";
  note.textContent = message;
  layout.contentBody.append(note);
};

const updateMobileSelect = () => {
  const select = layout.mobileSelect;
  select.innerHTML = "";
  const entries = state.roots.flatMap((rootEntry) =>
    rootEntry.prds.map((prd) => ({ rootEntry, prd })),
  );
  select.disabled = entries.length === 0;
  if (entries.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No PRDs available";
    option.value = "";
    option.selected = true;
    select.append(option);
    return;
  }
  for (const entry of entries) {
    const progress = normalizeProgress(entry.prd.progress);
    const progressEmoji = progressToEmoji(progress);
    const option = document.createElement("option");
    option.value = encodeURIComponent(`${entry.rootEntry.id}:${entry.prd.id}`);
    const labelText = entry.rootEntry.meta.rootLabel ?? "";
    const branchText = entry.rootEntry.meta.gitBranch ?? "";
    const rootPrefix = labelText
      ? branchText
        ? `${labelText} @${branchText}`
        : labelText
      : branchText
        ? `@${branchText}`
        : "";
    option.textContent = rootPrefix
      ? `${rootPrefix} / ${entry.prd.label} ${progressEmoji}`
      : `${entry.prd.label} ${progressEmoji}`;
    if (
      state.selection &&
      state.selection.rootId === entry.rootEntry.id &&
      state.selection.prdId === entry.prd.id
    ) {
      option.selected = true;
    }
    select.append(option);
  }
};

layout.mobileSelect.addEventListener("change", (event) => {
  const target = event.target as HTMLSelectElement;
  const raw = target.value;
  if (!raw) return;
  let decoded = "";
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return;
  }
  const separator = decoded.indexOf(":");
  if (separator <= 0 || separator >= decoded.length - 1) return;
  const rootId = decoded.slice(0, separator);
  const prdId = decoded.slice(separator + 1);
  if (rootId && prdId) {
    setHash(rootId, prdId);
  }
});

const refreshSidebar = () => {
  renderSidebar(
    layout.sidebarContent,
    layout.sidebarFooter,
    state.roots,
    state.selection,
    state.collapsedRoots,
    (rootId, prdId) => {
      setHash(rootId, prdId);
    },
    (rootId) => {
      state.collapsedRoots[rootId] = !state.collapsedRoots[rootId];
      writeCollapsedRoots(state.collapsedRoots);
      refreshSidebar();
    },
    async (rootId) => {
      try {
        const payload = await removeRoot(rootId);
        await syncRoots(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to remove directory";
        renderError(message);
      }
    },
    async (path) => {
      try {
        const payload = await addRoot(path);
        await syncRoots(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add directory";
        renderError(message);
      }
    },
  );
  updateMobileSelect();
};

const loadSelection = async () => {
  if (!state.selection) {
    setContentMode(false);
    if (state.roots.length === 0) {
      renderEmpty("No directories configured. Use Add to include a project root.");
    } else {
      renderEmpty("No PRDs found in configured roots.");
    }
    return;
  }

  const { rootId, prdId } = state.selection;
  setContentMode(true);
  renderContent("Loading…");

  const requestId = ++selectionRequest;
  try {
    const selectedRoot = state.roots.find((rootEntry) => rootEntry.id === rootId);
    const selectedPrd = selectedRoot?.prds.find((prd) => prd.id === prdId);
    if (!selectedRoot || !selectedPrd) {
      throw new Error("PRD not found");
    }

    const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    const normalizedDocs = selectedPrd.docs
      .map((raw) => {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        const withoutExt = trimmed.toLowerCase().endsWith(".md") ? trimmed.slice(0, -3) : trimmed;
        if (!withoutExt) return null;
        return { original: trimmed, id: withoutExt };
      })
      .filter((doc): doc is { original: string; id: string } => doc !== null)
      .filter((doc, index, list) => {
        const key = doc.id.toLowerCase();
        return list.findIndex((candidate) => candidate.id.toLowerCase() === key) === index;
      })
      .filter((doc) => doc.id.toLowerCase() !== "plan")
      .sort((a, b) => collator.compare(a.id, b.id));

    const payload = await fetchPlan(rootId, prdId);
    if (requestId !== selectionRequest) return;

    const docPayloads = await Promise.all(
      normalizedDocs.map(async (doc) => {
        try {
          const response = await fetchMarkdown(rootId, prdId, doc.id);
          return { ...doc, markdown: response.markdown };
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Failed to load content";
          throw new Error(`Failed to load ${doc.original}: ${detail}`);
        }
      }),
    );

    if (requestId !== selectionRequest) return;

    const sections: MarkdownSection[] = [
      { kind: "plan", id: "plan", markdown: payload.planMarkdown },
      ...docPayloads.map(
        (doc): MarkdownSection => ({
          kind: "doc",
          id: doc.id,
          label: doc.original,
          markdown: doc.markdown,
        }),
      ),
    ];

    layout.contentBody.innerHTML = "";
    const planContainer = document.createElement("div");
    planContainer.className = "plan-container";
    layout.contentBody.append(planContainer);
    state.lastPlan = {
      rootId,
      prdId,
      planMarkdown: payload.planMarkdown,
      planJsonText: payload.planJsonText,
    };
    await renderPlanView(planContainer, sections, payload.planJsonText, currentTheme);
  } catch (error) {
    if (requestId !== selectionRequest) {
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to load content";
    renderError(message);
  }
};

const syncRoots = async (payload: { roots: RootSummary[] }) => {
  state.roots = payload.roots;
  const didUpdateHash = ensureSelection();
  refreshSidebar();
  if (!didUpdateHash) {
    await loadSelection();
  }
};

const bootstrap = async () => {
  state.collapsedRoots = readCollapsedRoots();
  try {
    const payload = await fetchRoots();
    await syncRoots(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load directories";
    renderError(message);
  }
};

window.addEventListener("hashchange", async () => {
  const didUpdateHash = ensureSelection();
  refreshSidebar();
  if (!didUpdateHash) {
    await loadSelection();
  }
});

void bootstrap();
