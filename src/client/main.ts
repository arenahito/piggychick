import { fetchMarkdown, fetchPlan, fetchPrds, type PrdListMeta, type PrdSummary } from "./api";
import { createLayout } from "./components/layout";
import { renderSidebar, type DocKind, type Selection } from "./components/sidebar";
import { renderMarkdown, renderMermaid, setMermaidTheme } from "./renderers/markdown";
import { renderPlanView } from "./components/plan-view";
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
  lastPlan: null
};

const sidebarCollapsedKey = "pgch.sidebarCollapsed";

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

const parseHash = (): (Selection & { implicitDoc: boolean }) | null => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return null;
  const [prdIdRaw, ...docParts] = raw.split("/");
  if (!prdIdRaw) return null;
  let prdId = "";
  try {
    prdId = decodeURIComponent(prdIdRaw);
  } catch {
    return null;
  }
  const docRaw = docParts.join("/");
  const implicitDoc = docRaw.length === 0;
  let doc = "plan";
  if (docRaw) {
    try {
      doc = decodeURIComponent(docRaw);
    } catch {
      return null;
    }
    if (!doc) return null;
  }
  return { prdId, doc, implicitDoc };
};

const setHash = (prdId: string, doc: DocKind) => {
  window.location.hash = `#/${encodeURIComponent(prdId)}/${encodeURIComponent(doc)}`;
};

const ensureSelection = () => {
  let updatedHash = false;
  const parsed = parseHash();
  if (parsed) {
    const match = state.prds.find((prd) => prd.id === parsed.prdId);
    if (match) {
      let doc = parsed.doc;
      if (doc !== "plan" && !match.docs.includes(doc)) doc = "plan";
      state.selection = { prdId: match.id, doc };
      if (doc !== parsed.doc || parsed.implicitDoc) {
        setHash(match.id, doc);
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
  const fallback: Selection = { prdId: first.id, doc: "plan" };
  state.selection = fallback;
  setHash(fallback.prdId, fallback.doc);
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

const setContentMode = (doc: DocKind | null) => {
  if (doc === "plan") {
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
    ? (gitBranch ? `${rootLabel} @${gitBranch}` : rootLabel)
    : (gitBranch ? `@${gitBranch}` : "");
  for (const prd of state.prds) {
    const docs: DocKind[] = ["plan", ...prd.docs];
    const progress = normalizeProgress(prd.progress);
    const progressEmoji = progressToEmoji(progress);

    for (const doc of docs) {
      const option = document.createElement("option");
      option.value = `${encodeURIComponent(prd.id)}|${encodeURIComponent(doc)}`;
      option.textContent = rootPrefix
        ? `${rootPrefix} / ${prd.label} ${progressEmoji} / ${doc}`
        : `${prd.label} ${progressEmoji} / ${doc}`;
      if (state.selection && state.selection.prdId === prd.id && state.selection.doc === doc) {
        option.selected = true;
      }
      select.append(option);
    }
  }
};

layout.mobileSelect.addEventListener("change", (event) => {
  const target = event.target as HTMLSelectElement;
  const [prdIdRaw, docRaw] = target.value.split("|");
  if (!prdIdRaw) return;
  let prdId = "";
  try {
    prdId = decodeURIComponent(prdIdRaw);
  } catch {
    return;
  }
  if (!docRaw) return;
  let doc = "";
  try {
    doc = decodeURIComponent(docRaw);
  } catch {
    return;
  }
  if (prdId && doc) {
    setHash(prdId, doc);
  }
});

const refreshSidebar = () => {
  renderSidebar(
    layout.sidebarContent,
    state.rootMeta,
    state.prds,
    state.selection,
    state.sidebarCollapsed,
    (prdId, doc) => {
      setHash(prdId, doc);
    },
    () => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      writeSidebarCollapsed(state.sidebarCollapsed);
      refreshSidebar();
    }
  );
  updateMobileSelect();
};

const loadSelection = async () => {
  if (!state.selection) {
    setContentMode(null);
    renderEmpty("No PRDs found in .tasks");
    return;
  }

  const { prdId, doc } = state.selection;
  setContentMode(doc);
  renderContent("Loading…");

  try {
    if (doc === "plan") {
      const payload = await fetchPlan(prdId);
      layout.contentBody.innerHTML = "";
      const planContainer = document.createElement("div");
      planContainer.className = "plan-container";
      layout.contentBody.append(planContainer);
      state.lastPlan = { prdId, planMarkdown: payload.planMarkdown, planJsonText: payload.planJsonText };
      await renderPlanView(planContainer, payload.planMarkdown, payload.planJsonText, currentTheme);
      return;
    }
    const payload = await fetchMarkdown(prdId, doc);
    renderContent(payload.markdown);
  } catch (error) {
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
