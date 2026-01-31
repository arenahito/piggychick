import type { PrdListMeta, PrdSummary } from "../api";
import { normalizeProgress, progressToEmoji, progressToLabel } from "../progress";

export type DocKind = "plan" | string;

export type Selection = {
  prdId: string;
  doc: DocKind;
};

type SelectHandler = (prdId: string, doc: DocKind) => void;

export const renderSidebar = (
  container: HTMLElement,
  rootMeta: PrdListMeta | null,
  prds: PrdSummary[],
  selection: Selection | null,
  isCollapsed: boolean,
  onSelect: SelectHandler,
  onToggleCollapse: () => void
) => {
  container.innerHTML = "";
  const shouldCollapse = isCollapsed && rootMeta !== null;
  if (rootMeta) {
    const headerText = rootMeta.rootLabel
      ? (rootMeta.gitBranch ? `${rootMeta.rootLabel} @${rootMeta.gitBranch}` : rootMeta.rootLabel)
      : (rootMeta.gitBranch ? `@${rootMeta.gitBranch}` : "");
    const trimmedHeader = headerText.trim();
    const displayHeader = trimmedHeader || "PRDs";
    if (displayHeader) {
      const labelText = rootMeta.rootLabel?.trim() ?? "";
      const branchText = rootMeta.gitBranch?.trim() ?? "";
      const rootHeader = document.createElement("div");
      rootHeader.className = "sidebar-root";
      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.className = "sidebar-root-toggle";
      if (labelText) {
        const label = document.createElement("span");
        label.className = "sidebar-root-label";
        label.textContent = labelText;
        toggleButton.append(label);
      }
      if (branchText) {
        const branch = document.createElement("span");
        branch.className = "sidebar-root-branch";
        branch.textContent = labelText ? ` @${branchText}` : `@${branchText}`;
        toggleButton.append(branch);
      }
      if (!labelText && !branchText) {
        const fallback = document.createElement("span");
        fallback.className = "sidebar-root-label";
        fallback.textContent = displayHeader;
        toggleButton.append(fallback);
      }
      toggleButton.setAttribute("aria-expanded", String(!shouldCollapse));
      const toggleLabel = shouldCollapse ? "Show PRDs" : "Hide PRDs";
      toggleButton.setAttribute("title", displayHeader);
      toggleButton.setAttribute("aria-label", `${displayHeader} ${toggleLabel}`);
      toggleButton.addEventListener("click", () => onToggleCollapse());
      rootHeader.append(toggleButton);

      const rootPath = rootMeta.rootPath?.trim() ?? "";
      if (rootPath) {
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "sidebar-root-copy";
        const idleLabel = "COPY";
        copyButton.textContent = idleLabel;
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
            copyButton.textContent = "COPIED";
            copyButton.setAttribute("title", "Copied");
            copyButton.setAttribute("aria-label", "Copied");
          } else if (state === "error") {
            copyButton.textContent = "FAILED";
            copyButton.setAttribute("title", "Copy failed");
            copyButton.setAttribute("aria-label", "Copy failed");
          } else {
            copyButton.textContent = idleLabel;
            copyButton.setAttribute("title", "Copy path");
            copyButton.setAttribute("aria-label", "Copy path");
          }
          if (state !== "idle") {
            resetHandle = window.setTimeout(() => setCopyState("idle"), 1500);
          }
        };
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
        copyButton.addEventListener("click", (event) => {
          event.stopPropagation();
          void copyWithFallback(rootPath)
            .then((ok) => setCopyState(ok ? "copied" : "error"))
            .catch(() => setCopyState("error"));
        });
        rootHeader.append(copyButton);
      }

      container.append(rootHeader);
    }
  }

  if (shouldCollapse) {
    return;
  }

  for (const prd of prds) {
    const group = document.createElement("div");
    group.className = "sidebar-group";

    const titleRow = document.createElement("div");
    titleRow.className = "sidebar-group-title-row";

    const title = document.createElement("div");
    title.className = "sidebar-group-title";
    title.textContent = prd.label;

    const status = document.createElement("div");
    status.className = "sidebar-group-title-status";
    const progress = normalizeProgress(prd.progress);
    status.textContent = progressToEmoji(progress);
    status.setAttribute("role", "img");
    status.setAttribute("aria-label", progressToLabel(progress));

    titleRow.append(title, status);

    const items = document.createElement("div");
    items.className = "sidebar-items";

    const docs: DocKind[] = ["plan", ...prd.docs];

    for (const doc of docs) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-item";
      button.textContent = doc;
      if (selection && selection.prdId === prd.id && selection.doc === doc) {
        button.classList.add("is-active");
      }
      button.addEventListener("click", () => onSelect(prd.id, doc));
      items.append(button);
    }

    group.append(titleRow, items);
    container.append(group);
  }
};
