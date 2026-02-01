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
  prdPath?: string,
) => {
  container.innerHTML = "";

  const copyWithFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}
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

  const wrapper = document.createElement("div");
  wrapper.className = "plan-view";

  const markdownPane = document.createElement("section");
  markdownPane.className = "plan-pane plan-markdown";

  const docTargets = new Map<string, HTMLElement>();
  const prdPathValue = typeof prdPath === "string" ? prdPath.trim() : "";
  let pathHeader: HTMLDivElement | null = null;

  if (prdPathValue) {
    pathHeader = document.createElement("div");
    pathHeader.className = "plan-prd-path";

    const pathText = document.createElement("div");
    pathText.className = "plan-prd-path-text";
    pathText.textContent = prdPathValue;

    const copyStatus = document.createElement("span");
    copyStatus.className = "sr-only";
    copyStatus.setAttribute("role", "status");
    copyStatus.setAttribute("aria-live", "polite");
    copyStatus.setAttribute("aria-atomic", "true");

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "plan-prd-copy";
    copyButton.textContent = "📋";
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
        copyStatus.textContent = "Copied";
      } else if (state === "error") {
        copyStatus.textContent = "Copy failed";
      } else {
        copyStatus.textContent = "";
      }
      if (state !== "idle") {
        resetHandle = window.setTimeout(() => setCopyState("idle"), 1500);
      }
    };

    copyButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void copyWithFallback(prdPathValue)
        .then((ok) => setCopyState(ok ? "copied" : "error"))
        .catch(() => setCopyState("error"));
    });

    pathHeader.append(pathText, copyButton, copyStatus);
  }

  for (const section of sections) {
    const block = document.createElement("article");
    block.className = "plan-section";

    if (section.kind === "doc") {
      docTargets.set(section.id, block);
      const header = document.createElement("div");
      header.className = "plan-section-header";

      const title = document.createElement("div");
      title.className = "plan-section-title";
      title.textContent = section.label ?? section.id;

      const topButton = document.createElement("button");
      topButton.type = "button";
      topButton.className = "plan-section-top";
      topButton.textContent = "⬆";
      topButton.setAttribute("aria-label", "Scroll to top");
      topButton.addEventListener("click", () => {
        markdownPane.scrollTo({ top: 0, behavior: "smooth" });
      });

      header.append(title, topButton);
      block.append(header);
    }

    const body = document.createElement("div");
    body.className = "content-markdown markdown-body";
    body.innerHTML = renderMarkdown(section.markdown);
    block.append(body);

    markdownPane.append(block);
  }

  const docSections = sections.filter((section) => section.kind === "doc");
  let nav: HTMLElement | null = null;
  if (docSections.length > 0) {
    nav = document.createElement("nav");
    nav.className = "plan-doc-nav";
    nav.setAttribute("aria-label", "Markdown sections");
    for (const section of docSections) {
      const target = docTargets.get(section.id);
      if (!target) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "plan-doc-link";
      button.textContent = section.label ?? section.id;
      button.addEventListener("click", () => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nav.append(button);
    }
  }

  if (pathHeader) {
    markdownPane.prepend(pathHeader);
  }

  if (nav) {
    if (pathHeader) {
      pathHeader.after(nav);
    } else {
      markdownPane.prepend(nav);
    }
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
