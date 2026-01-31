import type { PrdSummary } from "../api";
import { normalizeProgress, progressToEmoji, progressToLabel } from "../progress";

export type DocKind = "plan" | string;

export type Selection = {
  prdId: string;
  doc: DocKind;
};

type SelectHandler = (prdId: string, doc: DocKind) => void;

export const renderSidebar = (
  container: HTMLElement,
  prds: PrdSummary[],
  selection: Selection | null,
  onSelect: SelectHandler
) => {
  container.innerHTML = "";

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
