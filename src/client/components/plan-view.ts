import { renderMarkdown, renderMermaid } from "../renderers/markdown";
import { buildPlanGraph } from "../renderers/plan-graph";

export type MarkdownSection = {
  kind: "plan" | "doc";
  id: string;
  label?: string;
  markdown: string;
};

export const renderPlanView = async (
  container: HTMLElement,
  sections: MarkdownSection[],
  planJsonText: string,
  theme: "dark",
) => {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "plan-view";

  const markdownPane = document.createElement("section");
  markdownPane.className = "plan-pane plan-markdown";

  for (const section of sections) {
    const block = document.createElement("article");
    block.className = "plan-section";

    if (section.kind === "doc") {
      const header = document.createElement("div");
      header.className = "plan-section-title";
      header.textContent = section.label ?? section.id;
      block.append(header);
    }

    const body = document.createElement("div");
    body.className = "content-markdown markdown-body";
    body.innerHTML = renderMarkdown(section.markdown);
    block.append(body);

    markdownPane.append(block);
  }

  const graphPane = document.createElement("section");
  graphPane.className = "plan-pane plan-graph";

  const graph = buildPlanGraph(planJsonText, theme);
  if (graph.kind === "error") {
    const error = document.createElement("div");
    error.className = "plan-graph-error";
    error.textContent = graph.message;
    graphPane.append(error);
  } else {
    graphPane.innerHTML = `<pre class="mermaid">${graph.mermaid}</pre>`;
  }

  wrapper.append(markdownPane, graphPane);
  container.append(wrapper);

  await renderMermaid(wrapper);

  if (graph.kind === "graph") {
    attachGraphScroll(markdownPane, graphPane);
  }
};

const normalizeText = (value: string) => {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
};

const findMarkdownTarget = (markdownPane: HTMLElement, label: string) => {
  const term = label.trim();
  if (!term) return null;
  const normalizedTerm = normalizeText(term);
  const selectors = ["h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "blockquote"];
  const elements = markdownPane.querySelectorAll<HTMLElement>(selectors.join(","));
  for (const element of elements) {
    const text = normalizeText(element.textContent ?? "");
    if (text.includes(normalizedTerm)) {
      return element;
    }
  }
  return null;
};

const attachGraphScroll = (markdownPane: HTMLElement, graphPane: HTMLElement) => {
  const nodeElements = graphPane.querySelectorAll<SVGGElement>("svg g.node");
  if (nodeElements.length === 0) return;
  for (const nodeElement of nodeElements) {
    const label =
      nodeElement.querySelector("g.label")?.textContent ??
      nodeElement.querySelector("foreignObject")?.textContent ??
      nodeElement.querySelector("text")?.textContent;
    if (!label) continue;
    nodeElement.addEventListener("click", () => {
      const target = findMarkdownTarget(markdownPane, label);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
};
