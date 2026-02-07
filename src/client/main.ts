import {
  fetchConfig,
  fetchMarkdown,
  fetchPlan,
  fetchRoots,
  saveConfig,
  type RootSummary,
} from "./api";
import {
  renderConfigEditor,
  renderConfigEditorError,
  type ConfigEditorHandle,
  type ConfigToastState,
} from "./components/config-editor";
import { createLayout } from "./components/layout";
import { renderSidebar, type Selection } from "./components/sidebar";
import { renderPlanView, type MarkdownSection } from "./components/plan-view";
import { renderMarkdown, renderMermaid, setMermaidTheme } from "./renderers/markdown";
import { normalizeProgress, progressToLabel } from "./progress";
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
  expandedRoots: Record<string, boolean>;
  showIncompleteOnly: boolean;
  lastPlan: {
    rootId: string;
    prdId: string;
    planMarkdown: string;
    planJsonText: string;
    prdPath: string;
  } | null;
  viewMode: "plan" | "config";
  config: { path: string; text: string; isSaving: boolean; toast: ConfigToastState | null } | null;
} = {
  roots: [],
  selection: null,
  collapsedRoots: {},
  expandedRoots: {},
  showIncompleteOnly: false,
  lastPlan: null,
  viewMode: "plan",
  config: null,
};

const collapsedRootsKey = "pgch.sidebarCollapsedRoots";
const expandedRootsKey = "pgch.sidebarExpandedRoots";
const showIncompleteOnlyKey = "pgch.sidebarShowIncompleteOnly";
let selectionRequest = 0;
let configRequest = 0;
let configHandle: ConfigEditorHandle | null = null;

const readBooleanRecord = (key: string) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "boolean"),
    );
  } catch {
    return {};
  }
};

const writeBooleanRecord = (key: string, value: Record<string, boolean>) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

const readCollapsedRoots = () => readBooleanRecord(collapsedRootsKey);
const writeCollapsedRoots = (value: Record<string, boolean>) =>
  writeBooleanRecord(collapsedRootsKey, value);
const readExpandedRoots = () => readBooleanRecord(expandedRootsKey);
const writeExpandedRoots = (value: Record<string, boolean>) =>
  writeBooleanRecord(expandedRootsKey, value);

const readShowIncompleteOnly = () => {
  try {
    const raw = localStorage.getItem(showIncompleteOnlyKey);
    if (!raw) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
};

const writeShowIncompleteOnly = (value: boolean) => {
  try {
    localStorage.setItem(showIncompleteOnlyKey, JSON.stringify(value));
  } catch {
    return;
  }
};

type HashRoute =
  | { kind: "config"; hasExtra: boolean }
  | { kind: "prd"; rootId: string; prdId: string; hasExtra: boolean };

const settingsHash = "#/settings";

const setSettingsHash = () => {
  if (window.location.hash !== settingsHash) {
    window.location.hash = settingsHash;
  }
};

const parseHash = (): HashRoute | null => {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return null;
  const [rootRaw, prdRaw, ...extraParts] = raw.split("/");
  const normalizedRoot = rootRaw.toLowerCase();
  const hasTrailing = typeof prdRaw === "string";
  const hasExtra = hasTrailing || extraParts.some((part) => part.length > 0);
  if (
    (normalizedRoot === "settings" || normalizedRoot === "config") &&
    (!prdRaw || prdRaw === "")
  ) {
    return { kind: "config", hasExtra };
  }
  if (rootRaw && rootRaw.includes(":")) {
    try {
      const decoded = decodeURIComponent(rootRaw);
      const separator = decoded.indexOf(":");
      if (separator <= 0 || separator >= decoded.length - 1) return null;
      const rootId = decoded.slice(0, separator);
      const prdId = decoded.slice(separator + 1);
      const hasExtraSegment = prdRaw ? true : extraParts.some((part) => part.length > 0);
      return rootId && prdId ? { kind: "prd", rootId, prdId, hasExtra: hasExtraSegment } : null;
    } catch {
      return null;
    }
  }
  if (rootRaw && prdRaw) {
    try {
      const rootId = decodeURIComponent(rootRaw);
      const prdId = decodeURIComponent(prdRaw);
      const hasExtraSegment = extraParts.some((part) => part.length > 0);
      return rootId && prdId ? { kind: "prd", rootId, prdId, hasExtra: hasExtraSegment } : null;
    } catch {
      return null;
    }
  }
  if (!rootRaw) return null;
  try {
    const decoded = decodeURIComponent(rootRaw);
    const separator = decoded.indexOf(":");
    if (separator <= 0 || separator >= decoded.length - 1) return null;
    const rootId = decoded.slice(0, separator);
    const prdId = decoded.slice(separator + 1);
    const hasExtraSegment = extraParts.some((part) => part.length > 0);
    return rootId && prdId ? { kind: "prd", rootId, prdId, hasExtra: hasExtraSegment } : null;
  } catch {
    return null;
  }
};

const setHash = (rootId: string, prdId: string) => {
  window.location.hash = `#/${encodeURIComponent(rootId)}/${encodeURIComponent(prdId)}`;
};

const isSelectionValid = (selection: Selection | null) => {
  if (!selection) return false;
  const rootEntry = state.roots.find((root) => root.id === selection.rootId);
  if (!rootEntry) return false;
  return rootEntry.prds.some((entry) => entry.id === selection.prdId);
};

const navigateToSelection = () => {
  if (isSelectionValid(state.selection) && state.selection) {
    setHash(state.selection.rootId, state.selection.prdId);
    return;
  }
  window.location.hash = "";
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

const ensureSelection = (
  route: HashRoute | null,
): { didUpdateHash: boolean; kind: "config" | "plan" } => {
  let updatedHash = false;
  if (route?.kind === "config") {
    if (route.hasExtra) {
      setSettingsHash();
      updatedHash = true;
    }
    if (isSelectionValid(state.selection)) {
      return { didUpdateHash: updatedHash, kind: "config" };
    }
    const fallback = findFirstSelection();
    if (!fallback) {
      state.selection = null;
      return { didUpdateHash: updatedHash, kind: "config" };
    }
    state.selection = fallback;
    return { didUpdateHash: updatedHash, kind: "config" };
  }
  if (route?.kind === "prd") {
    const rootEntry = state.roots.find((root) => root.id === route.rootId);
    const prd = rootEntry?.prds.find((entry) => entry.id === route.prdId);
    if (rootEntry && prd) {
      state.selection = { rootId: rootEntry.id, prdId: prd.id };
      if (route.hasExtra) {
        setHash(rootEntry.id, prd.id);
        updatedHash = true;
      }
      return { didUpdateHash: updatedHash, kind: "plan" };
    }
  }

  const fallback = findFirstSelection();
  if (!fallback) {
    state.selection = null;
    return { didUpdateHash: updatedHash, kind: "plan" };
  }
  state.selection = fallback;
  setHash(fallback.rootId, fallback.prdId);
  updatedHash = true;
  return { didUpdateHash: updatedHash, kind: "plan" };
};

const setViewMode = (mode: "plan" | "config" | "empty") => {
  layout.content.classList.toggle("app-content--plan", mode === "plan");
  layout.content.classList.toggle("app-content--config", mode === "config");
};

const renderEmpty = (message: string) => {
  state.viewMode = "plan";
  setViewMode("empty");
  layout.contentBody.innerHTML = "";
  const note = document.createElement("div");
  note.className = "content-note";
  note.textContent = message;
  layout.contentBody.append(note);
};

const renderContent = (body: string) => {
  state.viewMode = "plan";
  setViewMode("plan");
  layout.contentBody.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "content-markdown markdown-body";
  wrapper.innerHTML = renderMarkdown(body);

  layout.contentBody.append(wrapper);
  void renderMermaid(wrapper);
};

const renderError = (message: string) => {
  state.viewMode = "plan";
  setViewMode("empty");
  layout.contentBody.innerHTML = "";
  const note = document.createElement("div");
  note.className = "content-error";
  note.textContent = message;
  layout.contentBody.append(note);
};

const filterPrds = (prds: RootSummary["prds"]) => {
  if (!state.showIncompleteOnly) return prds;
  return prds.filter((prd) => normalizeProgress(prd.progress) !== "done");
};

const updateMobileSelect = () => {
  const select = layout.mobileSelect;
  select.innerHTML = "";
  const entries = state.roots.flatMap((rootEntry) =>
    filterPrds(rootEntry.prds).map((prd) => ({ rootEntry, prd })),
  );
  const selectionVisible =
    state.selection !== null &&
    entries.some(
      (entry) =>
        entry.rootEntry.id === state.selection?.rootId && entry.prd.id === state.selection?.prdId,
    );
  select.disabled = entries.length === 0;
  if (entries.length === 0) {
    const option = document.createElement("option");
    option.textContent =
      state.selection && !selectionVisible ? "Selection hidden by filter" : "No PRDs available";
    option.value = "";
    option.selected = true;
    option.disabled = true;
    select.append(option);
    return;
  }
  if (state.selection && !selectionVisible) {
    const option = document.createElement("option");
    option.textContent = "Selection hidden by filter";
    option.value = "";
    option.selected = true;
    option.disabled = true;
    select.append(option);
  }
  for (const entry of entries) {
    const progress = normalizeProgress(entry.prd.progress);
    const progressLabel = progressToLabel(progress);
    const option = document.createElement("option");
    option.value = `${encodeURIComponent(entry.rootEntry.id)}/${encodeURIComponent(entry.prd.id)}`;
    const labelText = entry.rootEntry.meta.rootLabel ?? "";
    const branchText = entry.rootEntry.meta.gitBranch ?? "";
    const rootPrefix = labelText
      ? branchText
        ? `${labelText} @${branchText}`
        : labelText
      : branchText
        ? `@${branchText}`
        : "";
    const worktreeLabel = entry.prd.worktree?.label;
    const prdLabel = worktreeLabel ? `${entry.prd.label} (${worktreeLabel})` : entry.prd.label;
    option.textContent = rootPrefix
      ? `${rootPrefix} / ${prdLabel} (${progressLabel})`
      : `${prdLabel} (${progressLabel})`;
    if (
      selectionVisible &&
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
  const [rootRaw, prdRaw] = raw.split("/");
  if (rootRaw && prdRaw) {
    try {
      const rootId = decodeURIComponent(rootRaw);
      const prdId = decodeURIComponent(prdRaw);
      if (rootId && prdId) {
        setHash(rootId, prdId);
      }
    } catch {
      return;
    }
    return;
  }
  try {
    const decoded = decodeURIComponent(raw);
    const separator = decoded.indexOf(":");
    if (separator <= 0 || separator >= decoded.length - 1) return;
    const rootId = decoded.slice(0, separator);
    const prdId = decoded.slice(separator + 1);
    if (rootId && prdId) {
      setHash(rootId, prdId);
    }
  } catch {
    return;
  }
});

let configToastTimer: number | null = null;

const setConfigToast = (toast: ConfigToastState | null) => {
  if (configToastTimer !== null) {
    window.clearTimeout(configToastTimer);
    configToastTimer = null;
  }
  if (state.config) {
    state.config.toast = toast;
  }
  if (configHandle) {
    configHandle.setToast(toast);
  }
  if (toast) {
    configToastTimer = window.setTimeout(() => {
      if (state.config) {
        state.config.toast = null;
      }
      configHandle?.setToast(null);
    }, 2500);
  }
};

const closeConfigEditor = async () => {
  state.viewMode = "plan";
  configRequest += 1;
  if (configToastTimer !== null) {
    window.clearTimeout(configToastTimer);
    configToastTimer = null;
  }
  configHandle = null;
  state.config = null;
  setViewMode("empty");
  refreshSidebar();
  await loadSelection();
};

const openConfigEditor = async () => {
  if (state.viewMode === "config") {
    return;
  }
  state.viewMode = "config";
  setViewMode("config");
  configHandle = null;
  layout.contentBody.innerHTML = "";
  const container = document.createElement("div");
  container.className = "config-container";
  layout.contentBody.append(container);
  const note = document.createElement("div");
  note.className = "content-note";
  note.textContent = "Loading config…";
  container.append(note);

  const requestId = ++configRequest;
  try {
    const payload = await fetchConfig();
    if (requestId !== configRequest) return;
    state.config = { path: payload.path, text: payload.text, isSaving: false, toast: null };
    configHandle = renderConfigEditor(container, {
      path: payload.path,
      text: payload.text,
      isSaving: false,
      onChange: (value) => {
        if (state.config) {
          state.config.text = value;
        }
      },
      onSave: () => {
        void saveConfigChanges();
      },
      onCancel: () => {
        navigateToSelection();
      },
    });
    configHandle.focus();
  } catch (error) {
    if (requestId !== configRequest) return;
    const message = error instanceof Error ? error.message : "Failed to load config";
    renderConfigEditorError(
      container,
      message,
      () => void openConfigEditor(),
      () => navigateToSelection(),
    );
  }
};

const saveConfigChanges = async () => {
  if (!state.config || !configHandle || state.config.isSaving) return;
  const requestId = configRequest;
  const activeConfig = state.config;
  const activeHandle = configHandle;
  activeConfig.isSaving = true;
  activeHandle.setSaving(true);
  setConfigToast(null);
  try {
    await saveConfig(activeConfig.text);
    if (
      state.viewMode !== "config" ||
      configRequest !== requestId ||
      state.config !== activeConfig ||
      configHandle !== activeHandle
    ) {
      return;
    }
    activeConfig.isSaving = false;
    activeHandle.setSaving(false);
    setConfigToast({ message: "Saved", variant: "success" });
    try {
      const payload = await fetchRoots();
      if (
        state.viewMode !== "config" ||
        configRequest !== requestId ||
        state.config !== activeConfig ||
        configHandle !== activeHandle
      ) {
        return;
      }
      await syncRoots(payload, { allowLoadSelection: false });
    } catch (error) {
      if (
        state.viewMode !== "config" ||
        configRequest !== requestId ||
        state.config !== activeConfig ||
        configHandle !== activeHandle
      ) {
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to refresh roots";
      setConfigToast({ message, variant: "warning" });
    }
  } catch (error) {
    if (
      state.viewMode !== "config" ||
      configRequest !== requestId ||
      state.config !== activeConfig ||
      configHandle !== activeHandle
    ) {
      return;
    }
    activeConfig.isSaving = false;
    activeHandle.setSaving(false);
    const message = error instanceof Error ? error.message : "Failed to save config";
    setConfigToast({ message, variant: "error" });
  }
};

const refreshSidebar = () => {
  renderSidebar(
    layout.sidebarContent,
    layout.sidebarFooter,
    state.roots,
    state.selection,
    state.collapsedRoots,
    state.expandedRoots,
    state.showIncompleteOnly,
    state.viewMode === "config",
    () => {
      setSettingsHash();
    },
    (rootId, prdId) => {
      setHash(rootId, prdId);
    },
    (rootId) => {
      state.collapsedRoots[rootId] = !state.collapsedRoots[rootId];
      writeCollapsedRoots(state.collapsedRoots);
      refreshSidebar();
    },
    (rootId) => {
      state.expandedRoots[rootId] = !state.expandedRoots[rootId];
      writeExpandedRoots(state.expandedRoots);
      refreshSidebar();
    },
    () => {
      const next: Record<string, boolean> = {};
      const expandedNext: Record<string, boolean> = {};
      for (const rootEntry of state.roots) {
        next[rootEntry.id] = false;
        expandedNext[rootEntry.id] = false;
      }
      state.collapsedRoots = next;
      state.expandedRoots = expandedNext;
      writeCollapsedRoots(state.collapsedRoots);
      writeExpandedRoots(state.expandedRoots);
      refreshSidebar();
    },
    () => {
      const next: Record<string, boolean> = {};
      const expandedNext: Record<string, boolean> = {};
      for (const rootEntry of state.roots) {
        next[rootEntry.id] = true;
        expandedNext[rootEntry.id] = false;
      }
      state.collapsedRoots = next;
      state.expandedRoots = expandedNext;
      writeCollapsedRoots(state.collapsedRoots);
      writeExpandedRoots(state.expandedRoots);
      refreshSidebar();
    },
    (value) => {
      state.showIncompleteOnly = value;
      writeShowIncompleteOnly(value);
      refreshSidebar();
    },
  );
  updateMobileSelect();
};

const loadSelection = async () => {
  if (state.viewMode === "config") {
    return;
  }
  if (!state.selection) {
    if (state.roots.length === 0) {
      renderEmpty("No directories configured. Use the CLI or Settings to add a project root.");
    } else {
      renderEmpty("No PRDs found in configured roots.");
    }
    return;
  }

  const { rootId, prdId } = state.selection;
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
      prdPath: payload.prdPath ?? "",
    };
    await renderPlanView(
      planContainer,
      sections,
      payload.planJsonText,
      currentTheme,
      payload.prdPath,
    );
  } catch (error) {
    if (requestId !== selectionRequest) {
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to load content";
    renderError(message);
  }
};

const syncRoots = async (
  payload: { roots: RootSummary[] },
  options: { allowLoadSelection?: boolean } = {},
) => {
  const allowLoadSelection = options.allowLoadSelection ?? true;
  state.roots = payload.roots;
  const rootIds = new Set(state.roots.map((rootEntry) => rootEntry.id));
  const pruneRecord = (value: Record<string, boolean>) => {
    const next: Record<string, boolean> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (rootIds.has(key) && typeof entry === "boolean") {
        next[key] = entry;
      }
    }
    return next;
  };
  state.collapsedRoots = pruneRecord(state.collapsedRoots);
  writeCollapsedRoots(state.collapsedRoots);
  state.expandedRoots = pruneRecord(state.expandedRoots);
  writeExpandedRoots(state.expandedRoots);
  const route = parseHash();
  const { didUpdateHash, kind } = ensureSelection(route);
  refreshSidebar();
  if (kind === "config") {
    return { didUpdateHash, kind };
  }
  if (allowLoadSelection && state.viewMode !== "config" && !didUpdateHash) {
    await loadSelection();
  }
  return { didUpdateHash, kind };
};

const bootstrap = async () => {
  state.collapsedRoots = readCollapsedRoots();
  state.expandedRoots = readExpandedRoots();
  state.showIncompleteOnly = readShowIncompleteOnly();
  try {
    const payload = await fetchRoots();
    const { kind } = await syncRoots(payload);
    if (kind === "config") {
      await openConfigEditor();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load directories";
    renderError(message);
  }
};

window.addEventListener("hashchange", async () => {
  const route = parseHash();
  const { didUpdateHash, kind } = ensureSelection(route);
  refreshSidebar();
  if (kind === "config") {
    if (state.viewMode !== "config") {
      await openConfigEditor();
    }
    return;
  }
  if (state.viewMode === "config") {
    await closeConfigEditor();
    return;
  }
  if (!didUpdateHash) {
    await loadSelection();
  }
});

void bootstrap();
