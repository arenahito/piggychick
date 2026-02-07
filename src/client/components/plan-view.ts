import { createIcon } from "../icons";
import { renderMarkdown, renderMermaid } from "../renderers/markdown";
import { buildPlanGraph } from "../renderers/plan-graph";
import {
  createDefaultGraphZoomState,
  createGraphTransform,
  didGraphDragExceedThreshold,
  formatGraphZoomPercent,
  panGraphByDelta,
  zoomGraphByStepAtPoint,
} from "./graph-zoom";

export type MarkdownSection = {
  kind: "plan" | "doc";
  id: string;
  label?: string;
  markdown: string;
};

let disposeGraphInteractions: (() => void) | null = null;

export const renderPlanView = async (
  container: HTMLElement,
  sections: MarkdownSection[],
  planJsonText: string,
  theme: "dark",
  prdPath?: string,
) => {
  if (disposeGraphInteractions) {
    disposeGraphInteractions();
    disposeGraphInteractions = null;
  }
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
      topButton.append(createIcon("chevron-double-up", "icon icon--sm"));
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

  const graphToolbar = document.createElement("div");
  graphToolbar.className = "plan-graph-toolbar";

  const zoomOutButton = document.createElement("button");
  zoomOutButton.type = "button";
  zoomOutButton.className = "plan-graph-zoom-btn";
  zoomOutButton.textContent = "-";
  zoomOutButton.setAttribute("aria-label", "Zoom out dependency graph");

  const zoomResetButton = document.createElement("button");
  zoomResetButton.type = "button";
  zoomResetButton.className = "plan-graph-zoom-reset";
  zoomResetButton.textContent = "100%";
  zoomResetButton.setAttribute("aria-label", "Reset dependency graph zoom");

  const zoomInButton = document.createElement("button");
  zoomInButton.type = "button";
  zoomInButton.className = "plan-graph-zoom-btn";
  zoomInButton.textContent = "+";
  zoomInButton.setAttribute("aria-label", "Zoom in dependency graph");

  const zoomStatus = document.createElement("span");
  zoomStatus.className = "sr-only";
  zoomStatus.setAttribute("role", "status");
  zoomStatus.setAttribute("aria-live", "polite");
  zoomStatus.setAttribute("aria-atomic", "true");

  graphToolbar.append(zoomOutButton, zoomResetButton, zoomInButton, zoomStatus);

  const graphViewport = document.createElement("div");
  graphViewport.className = "plan-graph-viewport";
  const graphCanvas = document.createElement("div");
  graphCanvas.className = "plan-graph-canvas";
  graphViewport.append(graphCanvas);

  const graph = buildPlanGraph(planJsonText, theme);
  if (graph.kind === "error") {
    const error = document.createElement("div");
    error.className = "plan-graph-error";
    error.textContent = graph.message;
    zoomOutButton.disabled = true;
    zoomResetButton.disabled = true;
    zoomInButton.disabled = true;
    graphCanvas.append(error);
  } else {
    graphCanvas.innerHTML = `<pre class="mermaid">${graph.mermaid}</pre>`;
  }

  graphPane.append(graphViewport, graphToolbar);

  wrapper.append(markdownPane, graphPane);
  container.append(wrapper);

  await renderMermaid(wrapper);

  if (graph.kind === "graph") {
    const controller = new AbortController();
    const graphInteractionState = setupGraphZoomControls(
      graphViewport,
      graphCanvas,
      zoomOutButton,
      zoomResetButton,
      zoomInButton,
      zoomStatus,
      controller.signal,
    );
    attachGraphScroll(
      markdownPane,
      graphCanvas,
      controller.signal,
      graphInteractionState.shouldSuppressNodeClick,
    );
    disposeGraphInteractions = () => {
      controller.abort();
    };
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

const setupGraphZoomControls = (
  graphViewport: HTMLElement,
  graphCanvas: HTMLElement,
  zoomOutButton: HTMLButtonElement,
  zoomResetButton: HTMLButtonElement,
  zoomInButton: HTMLButtonElement,
  zoomStatus: HTMLElement,
  signal: AbortSignal,
) => {
  graphCanvas.style.transformOrigin = "0 0";
  let zoomState = createDefaultGraphZoomState();
  let activePointerId: number | null = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerLastX = 0;
  let pointerLastY = 0;
  let hasPointerCapture = false;
  let dragged = false;
  let suppressNextNodeClick = false;
  const applyZoomState = (
    nextState: ReturnType<typeof createDefaultGraphZoomState>,
    announce: boolean,
  ) => {
    if (nextState === zoomState) {
      return;
    }
    zoomState = nextState;
    graphCanvas.style.transform = createGraphTransform(zoomState);
    const label = formatGraphZoomPercent(zoomState.scale);
    zoomResetButton.textContent = label;
    zoomResetButton.setAttribute("aria-label", `Reset dependency graph zoom (${label})`);
    if (announce) {
      zoomStatus.textContent = `Dependency graph zoom ${label}`;
    }
  };

  const getCenterPoint = () => {
    return {
      x: graphViewport.clientWidth / 2,
      y: graphViewport.clientHeight / 2,
    };
  };

  const zoomAtPoint = (direction: -1 | 1, point: { x: number; y: number }, announce: boolean) => {
    const nextState = zoomGraphByStepAtPoint(zoomState, direction, point);
    applyZoomState(nextState, announce);
  };

  applyZoomState(createDefaultGraphZoomState(), false);

  zoomOutButton.addEventListener(
    "click",
    () => {
      zoomAtPoint(-1, getCenterPoint(), true);
    },
    { signal },
  );

  zoomInButton.addEventListener(
    "click",
    () => {
      zoomAtPoint(1, getCenterPoint(), true);
    },
    { signal },
  );

  zoomResetButton.addEventListener(
    "click",
    () => {
      applyZoomState(createDefaultGraphZoomState(), true);
    },
    { signal },
  );

  graphViewport.addEventListener(
    "wheel",
    (event) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const rect = graphViewport.getBoundingClientRect();
      zoomAtPoint(
        direction,
        {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        },
        true,
      );
    },
    { passive: false, signal },
  );

  graphViewport.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) {
        return;
      }
      activePointerId = event.pointerId;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerLastX = event.clientX;
      pointerLastY = event.clientY;
      hasPointerCapture = false;
      dragged = false;
      suppressNextNodeClick = false;
    },
    { signal },
  );

  graphViewport.addEventListener(
    "pointermove",
    (event) => {
      if (activePointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - pointerLastX;
      const deltaY = event.clientY - pointerLastY;
      if (!dragged) {
        dragged = didGraphDragExceedThreshold(
          event.clientX - pointerStartX,
          event.clientY - pointerStartY,
        );
      }
      if (dragged) {
        if (!hasPointerCapture) {
          graphViewport.classList.add("plan-graph-viewport--dragging");
          graphViewport.setPointerCapture(event.pointerId);
          hasPointerCapture = true;
          suppressNextNodeClick = true;
        }
        if (deltaX !== 0 || deltaY !== 0) {
          applyZoomState(panGraphByDelta(zoomState, deltaX, deltaY), false);
        }
      }
      pointerLastX = event.clientX;
      pointerLastY = event.clientY;
    },
    { signal },
  );

  const clearPointerState = (event: PointerEvent) => {
    if (activePointerId !== event.pointerId) {
      return;
    }
    activePointerId = null;
    hasPointerCapture = false;
    graphViewport.classList.remove("plan-graph-viewport--dragging");
  };

  graphViewport.addEventListener("pointerup", clearPointerState, { signal });
  graphViewport.addEventListener("pointercancel", clearPointerState, { signal });
  graphViewport.addEventListener("lostpointercapture", clearPointerState, { signal });
  window.addEventListener("pointerup", clearPointerState, { signal });
  window.addEventListener("pointercancel", clearPointerState, { signal });

  return {
    shouldSuppressNodeClick: () => {
      if (!suppressNextNodeClick) {
        return false;
      }
      suppressNextNodeClick = false;
      return true;
    },
  };
};

const attachGraphScroll = (
  markdownPane: HTMLElement,
  graphRoot: HTMLElement,
  signal: AbortSignal,
  shouldSuppressNodeClick: () => boolean,
) => {
  const nodeElements = graphRoot.querySelectorAll<SVGGElement>("svg g.node");
  if (nodeElements.length === 0) return;
  for (const nodeElement of nodeElements) {
    const label =
      nodeElement.querySelector("g.label")?.textContent ??
      nodeElement.querySelector("foreignObject")?.textContent ??
      nodeElement.querySelector("text")?.textContent;
    if (!label) continue;
    nodeElement.addEventListener(
      "click",
      () => {
        if (shouldSuppressNodeClick()) {
          return;
        }
        const target = findMarkdownTarget(markdownPane, label);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
      { signal },
    );
  }
};
