import type { RootSummary } from "../api";
import { normalizeProgress, progressToEmoji, progressToLabel } from "../progress";

export type Selection = {
  rootId: string;
  prdId: string;
};

type SelectHandler = (rootId: string, prdId: string) => void;
type ToggleHandler = (rootId: string) => void;
type RemoveHandler = (rootId: string) => void;
type AddHandler = (path: string) => void;

export const renderSidebar = (
  content: HTMLElement,
  footer: HTMLElement,
  roots: RootSummary[],
  selection: Selection | null,
  collapsed: Record<string, boolean>,
  onSelect: SelectHandler,
  onToggleCollapse: ToggleHandler,
  onRemoveRoot: RemoveHandler,
  onAddRoot: AddHandler,
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

  for (const root of roots) {
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

    const actions = document.createElement("div");
    actions.className = "sidebar-root-actions";

    if (root.meta.rootPath) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "sidebar-root-copy";
      copyButton.textContent = "📋";
      copyButton.setAttribute("title", "Copy path");
      copyButton.setAttribute("aria-label", "Copy path");
      copyButton.setAttribute("aria-live", "polite");
      copyButton.setAttribute("aria-atomic", "true");
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
        } else if (state === "error") {
          copyButton.setAttribute("title", "Copy failed");
          copyButton.setAttribute("aria-label", "Copy failed");
        } else {
          copyButton.setAttribute("title", "Copy path");
          copyButton.setAttribute("aria-label", "Copy path");
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

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "sidebar-root-remove";
    removeButton.textContent = "❌";
    removeButton.setAttribute("title", "Remove directory");
    removeButton.setAttribute("aria-label", "Remove directory");
    removeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!window.confirm("Remove this directory?")) return;
      onRemoveRoot(root.id);
    });
    actions.append(removeButton);
    rootHeader.append(actions);

    rootSection.append(rootHeader);

    if (!shouldCollapse) {
      for (const prd of root.prds) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "sidebar-prd";
        if (selection && selection.rootId === root.id && selection.prdId === prd.id) {
          button.classList.add("is-active");
          button.setAttribute("aria-current", "true");
        }
        button.addEventListener("click", () => onSelect(root.id, prd.id));

        const title = document.createElement("span");
        title.className = "sidebar-prd-label";
        title.textContent = prd.label;

        const status = document.createElement("span");
        status.className = "sidebar-prd-status";
        const progress = normalizeProgress(prd.progress);
        status.textContent = progressToEmoji(progress);
        status.setAttribute("role", "img");
        status.setAttribute("aria-label", progressToLabel(progress));

        button.append(title, status);
        rootSection.append(button);
      }
    }

    content.append(rootSection);
  }

  const toolbar = document.createElement("form");
  toolbar.className = "sidebar-toolbar";
  const input = document.createElement("input");
  input.type = "text";
  input.name = "rootPath";
  input.placeholder = "Add directory path";
  input.autocomplete = "off";
  input.className = "sidebar-toolbar-input";
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "sidebar-toolbar-button";
  submit.textContent = "Add";
  toolbar.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    onAddRoot(value);
    input.value = "";
  });
  toolbar.append(input, submit);
  footer.append(toolbar);
};
