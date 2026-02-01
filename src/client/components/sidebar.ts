import type { RootSummary } from "../api";
import { createIcon } from "../icons";
import { normalizeProgress, progressToIcon, progressToLabel } from "../progress";

export type Selection = {
  rootId: string;
  prdId: string;
};

type SelectHandler = (rootId: string, prdId: string) => void;
type ToggleHandler = (rootId: string) => void;
type ToggleFilterHandler = (value: boolean) => void;
type ActionHandler = () => void;

export const renderSidebar = (
  content: HTMLElement,
  footer: HTMLElement,
  roots: RootSummary[],
  selection: Selection | null,
  collapsed: Record<string, boolean>,
  expanded: Record<string, boolean>,
  showIncompleteOnly: boolean,
  isConfigOpen: boolean,
  onOpenConfig: () => void,
  onSelect: SelectHandler,
  onToggleCollapse: ToggleHandler,
  onToggleExpand: ToggleHandler,
  onOpenAll: ActionHandler,
  onCloseAll: ActionHandler,
  onToggleIncomplete: ToggleFilterHandler,
) => {
  content.innerHTML = "";
  footer.innerHTML = "";

  const copyWithFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // continue to fallback
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    return ok;
  };

  const filterPrds = (prds: RootSummary["prds"]) => {
    if (!showIncompleteOnly) return prds;
    return prds.filter((prd) => normalizeProgress(prd.progress) !== "done");
  };

  for (const [index, root] of roots.entries()) {
    const rootSection = document.createElement("div");
    rootSection.className = "sidebar-root-section";
    const headerText = root.meta.rootLabel
      ? root.meta.gitBranch
        ? `${root.meta.rootLabel} @${root.meta.gitBranch}`
        : root.meta.rootLabel
      : root.meta.gitBranch
        ? `@${root.meta.gitBranch}`
        : "";
    const trimmedHeader = headerText.trim();
    const displayHeader = trimmedHeader || "PRDs";
    const labelText = root.meta.rootLabel?.trim() ?? "";
    const branchText = root.meta.gitBranch?.trim() ?? "";

    const rootHeader = document.createElement("div");
    rootHeader.className = "sidebar-root";

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "sidebar-root-toggle";
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "sidebar-root-toggle-icon";
    toggleIcon.setAttribute("aria-hidden", "true");
    toggleButton.append(toggleIcon);
    const textWrap = document.createElement("span");
    textWrap.className = "sidebar-root-text";
    const labelLine = labelText || (branchText ? "PRDs" : displayHeader);
    if (labelLine) {
      const label = document.createElement("span");
      label.className = "sidebar-root-label";
      label.textContent = labelLine;
      textWrap.append(label);
    }
    if (branchText) {
      const branch = document.createElement("span");
      branch.className = "sidebar-root-branch";
      branch.textContent = branchText;
      textWrap.append(branch);
    }
    toggleButton.append(textWrap);
    const shouldCollapse = collapsed[root.id] === true;
    toggleButton.setAttribute("aria-expanded", String(!shouldCollapse));
    const toggleLabel = shouldCollapse ? "Show PRDs" : "Hide PRDs";
    toggleButton.setAttribute("title", displayHeader);
    toggleButton.setAttribute("aria-label", `${displayHeader} ${toggleLabel}`);
    toggleButton.addEventListener("click", () => onToggleCollapse(root.id));
    rootHeader.append(toggleButton);

    const prdList = document.createElement("div");
    prdList.className = "sidebar-prd-list";
    const safeRootId = root.id.replace(/[^a-zA-Z0-9_-]/g, "");
    prdList.id = `sidebar-prd-list-${safeRootId || "root"}-${index}`;
    prdList.hidden = shouldCollapse;
    toggleButton.setAttribute("aria-controls", prdList.id);

    const actions = document.createElement("div");
    actions.className = "sidebar-root-actions";
    const copyStatus = document.createElement("span");
    copyStatus.className = "sr-only";
    copyStatus.setAttribute("role", "status");
    copyStatus.setAttribute("aria-live", "polite");
    copyStatus.setAttribute("aria-atomic", "true");

    if (root.meta.rootPath) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "sidebar-root-copy";
      copyButton.append(createIcon("clipboard", "icon icon--sm"));
      copyButton.setAttribute("title", "Copy path");
      copyButton.setAttribute("aria-label", "Copy path");
      copyButton.dataset.state = "idle";
      let resetHandle: number | null = null;
      const setCopyState = (state: "idle" | "copied" | "error") => {
        if (resetHandle !== null) {
          window.clearTimeout(resetHandle);
          resetHandle = null;
        }
        copyButton.dataset.state = state;
        if (state === "copied") {
          copyButton.setAttribute("title", "Copied");
          copyButton.setAttribute("aria-label", "Copied");
          copyStatus.textContent = "Copied";
        } else if (state === "error") {
          copyButton.setAttribute("title", "Copy failed");
          copyButton.setAttribute("aria-label", "Copy failed");
          copyStatus.textContent = "Copy failed";
        } else {
          copyButton.setAttribute("title", "Copy path");
          copyButton.setAttribute("aria-label", "Copy path");
          copyStatus.textContent = "";
        }
        if (state !== "idle") {
          resetHandle = window.setTimeout(() => setCopyState("idle"), 1500);
        }
      };
      copyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void copyWithFallback(root.meta.rootPath)
          .then((ok) => setCopyState(ok ? "copied" : "error"))
          .catch(() => setCopyState("error"));
      });
      actions.append(copyButton);
    }

    rootHeader.append(actions);
    rootHeader.append(copyStatus);

    rootSection.append(rootHeader);
    rootSection.append(prdList);

    if (!shouldCollapse) {
      const filteredPrds = filterPrds(root.prds);
      const hasOverflow = filteredPrds.length > 5;
      const isExpanded = expanded[root.id] === true;
      const visiblePrds = hasOverflow && !isExpanded ? filteredPrds.slice(0, 5) : filteredPrds;
      for (const prd of visiblePrds) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sidebar-prd";
        if (selection && selection.rootId === root.id && selection.prdId === prd.id) {
          button.classList.add("is-active");
          button.setAttribute("aria-current", "true");
        }
        button.addEventListener("click", () => onSelect(root.id, prd.id));

        const textWrap = document.createElement("span");
        textWrap.className = "sidebar-prd-text";
        const title = document.createElement("span");
        title.className = "sidebar-prd-title";
        title.textContent = prd.label;
        textWrap.append(title);
        if (prd.worktree?.label) {
          const worktree = document.createElement("span");
          worktree.className = "sidebar-prd-worktree";
          worktree.textContent = prd.worktree.label;
          textWrap.append(worktree);
        }

        const status = document.createElement("span");
        status.className = "sidebar-prd-status";
        const progress = normalizeProgress(prd.progress);
        status.append(progressToIcon(progress));
        status.setAttribute("role", "img");
        status.setAttribute("aria-label", progressToLabel(progress));
        if (progress === "done") {
          status.classList.add("is-done");
        } else if (progress === "in_progress") {
          status.classList.add("is-in-progress");
        } else {
          status.classList.add("is-not-started");
        }

        button.append(textWrap, status);
        prdList.append(button);
      }
      if (hasOverflow) {
        const toggleMore = document.createElement("button");
        toggleMore.type = "button";
        toggleMore.className = "sidebar-prd-toggle";
        const remaining = Math.max(0, filteredPrds.length - 5);
        toggleMore.textContent = isExpanded ? "Show less" : `Show ${remaining} more`;
        toggleMore.setAttribute("aria-expanded", String(isExpanded));
        toggleMore.setAttribute("aria-label", isExpanded ? "Show fewer PRDs" : "Show more PRDs");
        toggleMore.setAttribute("aria-controls", prdList.id);
        toggleMore.addEventListener("click", () => onToggleExpand(root.id));
        prdList.append(toggleMore);
      }
    }

    content.append(rootSection);
  }

  const toolbar = document.createElement("div");
  toolbar.className = "sidebar-toolbar";
  const openAllButton = document.createElement("button");
  openAllButton.type = "button";
  openAllButton.className = "sidebar-tool-button sidebar-tool-button--icon";
  openAllButton.append(createIcon("folder-plus", "icon icon--md"));
  openAllButton.setAttribute("aria-label", "Open all folders");
  openAllButton.setAttribute("title", "Open all folders");
  openAllButton.addEventListener("click", () => onOpenAll());
  toolbar.append(openAllButton);

  const closeAllButton = document.createElement("button");
  closeAllButton.type = "button";
  closeAllButton.className = "sidebar-tool-button sidebar-tool-button--icon";
  closeAllButton.append(createIcon("folder-minus", "icon icon--md"));
  closeAllButton.setAttribute("aria-label", "Close all folders");
  closeAllButton.setAttribute("title", "Close all folders");
  closeAllButton.addEventListener("click", () => onCloseAll());
  toolbar.append(closeAllButton);

  const filterLabel = document.createElement("label");
  filterLabel.className = "sidebar-tool-toggle";
  filterLabel.setAttribute("title", "Show incomplete PRDs only");
  const filterInput = document.createElement("input");
  filterInput.type = "checkbox";
  filterInput.checked = showIncompleteOnly;
  filterInput.setAttribute("aria-label", "Show incomplete PRDs only");
  filterInput.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement;
    onToggleIncomplete(target.checked);
  });
  const filterEmoji = document.createElement("span");
  filterEmoji.className = "sidebar-tool-emoji";
  filterEmoji.setAttribute("aria-hidden", "true");
  filterEmoji.append(createIcon("funnel", "icon icon--sm"));
  const filterSwitch = document.createElement("span");
  filterSwitch.className = "sidebar-tool-switch";
  filterSwitch.setAttribute("aria-hidden", "true");
  filterLabel.append(filterInput, filterEmoji, filterSwitch);
  toolbar.append(filterLabel);
  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "sidebar-tool-button sidebar-tool-button--icon";
  settingsButton.append(createIcon("cog-6-tooth", "icon icon--md"));
  settingsButton.setAttribute("aria-label", "Open settings");
  settingsButton.setAttribute("title", "Open settings");
  settingsButton.disabled = isConfigOpen;
  settingsButton.addEventListener("click", () => onOpenConfig());
  toolbar.append(settingsButton);
  footer.append(toolbar);
};
