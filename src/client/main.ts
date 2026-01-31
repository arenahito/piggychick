import { fetchMarkdown, fetchPlan, fetchPrds, type PrdListMeta, type PrdSummary } from "./api";
import { createLayout } from "./components/layout";
import { renderSidebar, type Selection } from "./components/sidebar";
import { renderMarkdown, renderMermaid, setMermaidTheme } from "./renderers/markdown";
import { renderPlanView, type MarkdownSection } from "./components/plan-view";
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
  prds: PrdSummary[];
  rootMeta: PrdListMeta | null;
  selection: Selection | null;
  sidebarCollapsed: boolean;
  lastPlan: { prdId: string; planMarkdown: string; planJsonText: string } | null;
} = {
  prds: [],
  rootMeta: null,
  selection: null,
  sidebarCollapsed: false,
  lastPlan: null,
};

const sidebarCollapsedKey = "pgch.sidebarCollapsed";
let selectionRequest = 0;

const readSidebarCollapsed = () => {
  try {
    return localStorage.getItem(sidebarCollapsedKey) === "true";
  } catch {
    return false;
  }
};

const writeSidebarCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(sidebarCollapsedKey, value ? "true" : "false");
  } catch {
    return;
  }
};

const parseHash = (): { prdId: string; hasExtra: boolean } | null => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return null;
  const [prdIdRaw, ...extraParts] = raw.split("/");
  if (!prdIdRaw) return null;
  let prdId = "";
  try {
    prdId = decodeURIComponent(prdIdRaw);
  } catch {
    return null;
  }
  const hasExtra = extraParts.some((part) => part.length > 0);
  return { prdId, hasExtra };
};

const setHash = (prdId: string) => {
  window.location.hash = `#/${encodeURIComponent(prdId)}`;
};

const ensureSelection = () => {
  let updatedHash = false;
  const parsed = parseHash();
  if (parsed) {
    const match = state.prds.find((prd) => prd.id === parsed.prdId);
    if (match) {
      state.selection = { prdId: match.id };
      if (parsed.hasExtra) {
        setHash(match.id);
        updatedHash = true;
      }
      return updatedHash;
    }
  }

  const first = state.prds[0];
  if (!first) {
    state.selection = null;
    return updatedHash;
  }
  const fallback: Selection = { prdId: first.id };
  state.selection = fallback;
  setHash(fallback.prdId);
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
  select.disabled = state.prds.length === 0;
  if (state.prds.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No PRDs available";
    option.value = "";
    option.selected = true;
    select.append(option);
    return;
  }
  const rootLabel = state.rootMeta?.rootLabel ?? "";
  const gitBranch = state.rootMeta?.gitBranch ?? null;
  const rootPrefix = rootLabel
    ? gitBranch
      ? `${rootLabel} @${gitBranch}`
      : rootLabel
    : gitBranch
      ? `@${gitBranch}`
      : "";
  for (const prd of state.prds) {
    const progress = normalizeProgress(prd.progress);
    const progressEmoji = progressToEmoji(progress);
    const option = document.createElement("option");
    option.value = encodeURIComponent(prd.id);
    option.textContent = rootPrefix
      ? `${rootPrefix} / ${prd.label} ${progressEmoji}`
      : `${prd.label} ${progressEmoji}`;
    if (state.selection && state.selection.prdId === prd.id) {
      option.selected = true;
    }
    select.append(option);
  }
};

layout.mobileSelect.addEventListener("change", (event) => {
  const target = event.target as HTMLSelectElement;
  const prdIdRaw = target.value;
  if (!prdIdRaw) return;
  let prdId = "";
  try {
    prdId = decodeURIComponent(prdIdRaw);
  } catch {
    return;
  }
  if (prdId) {
    setHash(prdId);
  }
});

const refreshSidebar = () => {
  renderSidebar(
    layout.sidebarContent,
    state.rootMeta,
    state.prds,
    state.selection,
    state.sidebarCollapsed,
    (prdId) => {
      setHash(prdId);
    },
    () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      writeSidebarCollapsed(state.sidebarCollapsed);
      refreshSidebar();
    },
  );
  updateMobileSelect();
};

const loadSelection = async () => {
  if (!state.selection) {
    setContentMode(false);
    renderEmpty("No PRDs found in .tasks");
    return;
  }

  const { prdId } = state.selection;
  setContentMode(true);
  renderContent("Loading…");

  const requestId = ++selectionRequest;
  try {
    const selectedPrd = state.prds.find((prd) => prd.id === prdId);
    if (!selectedPrd) {
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

    const payload = await fetchPlan(prdId);
    if (requestId !== selectionRequest) return;

    const docPayloads = await Promise.all(
      normalizedDocs.map(async (doc) => {
        try {
          const response = await fetchMarkdown(prdId, doc.id);
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

const bootstrap = async () => {
  state.sidebarCollapsed = readSidebarCollapsed();
  try {
    const payload = await fetchPrds();
    state.prds = payload.prds;
    state.rootMeta = payload.meta;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load PRDs";
    renderError(message);
    return;
  }

  const didUpdateHash = ensureSelection();
  refreshSidebar();
  if (!didUpdateHash) {
    await loadSelection();
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
