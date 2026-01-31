import type { PrdSummary } from "../api";

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

    const title = document.createElement("div");
    title.className = "sidebar-group-title";
    title.textContent = prd.label;

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

    group.append(title, items);
    container.append(group);
  }
};
