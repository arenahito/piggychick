import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import DOMPurify from "dompurify";
import "d3-transition";
import mermaid from "mermaid";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

md.use(taskLists, { label: true, labelAfter: true });

const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim().split(/\s+/)[0];
  if (info === "mermaid") {
    const code = md.utils.escapeHtml(token.content);
    return `<pre class="mermaid">${code}</pre>`;
  }
  if (defaultFence) {
    return defaultFence(tokens, idx, options, env, self);
  }
  return self.renderToken(tokens, idx, options);
};

type MermaidTheme = "dark" | "default";

let mermaidConfigured = false;
let currentTheme: MermaidTheme = "dark";

type D3ListenerEntry = {
  type: string;
  listener: EventListener;
  options?: boolean | AddEventListenerOptions;
};

type D3ListenerNode = Element & {
  __on?: D3ListenerEntry[];
};

const disableMermaidNativeTooltips = (container: HTMLElement) => {
  const elements = container.querySelectorAll<SVGGElement>(".mermaid svg g[title]");
  for (const element of elements) {
    element.removeAttribute("title");
  }
  const nodes = container.querySelectorAll<Element>(".mermaid svg g.node");
  for (const node of nodes) {
    const d3Node = node as D3ListenerNode;
    const listeners = Array.isArray(d3Node.__on) ? d3Node.__on : null;
    if (!listeners) {
      continue;
    }
    const nextListeners: D3ListenerEntry[] = [];
    for (const entry of listeners) {
      if (entry.type === "mouseover" || entry.type === "mouseout") {
        node.removeEventListener(entry.type, entry.listener, entry.options);
        continue;
      }
      nextListeners.push(entry);
    }
    if (nextListeners.length === 0) {
      Reflect.deleteProperty(d3Node, "__on");
      continue;
    }
    d3Node.__on = nextListeners;
  }
};

export const setMermaidTheme = (theme: MermaidTheme) => {
  currentTheme = theme;
  mermaid.initialize({
    securityLevel: "strict",
    startOnLoad: false,
    theme,
  });
  mermaid.parseError = (error) => {
    console.warn("Mermaid parse error", error);
  };
  mermaidConfigured = true;
};

export const renderMarkdown = (markdown: string) => {
  const html = md.render(markdown);
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["input"],
    ADD_ATTR: ["checked", "disabled", "type"],
  });
};

export const renderMermaid = async (container: HTMLElement) => {
  if (!mermaidConfigured) {
    setMermaidTheme(currentTheme);
  }
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(".mermaid"));
  if (nodes.length === 0) return;
  for (const node of nodes) {
    if (!node.dataset.source) {
      node.dataset.source = node.textContent ?? "";
    }
    node.textContent = node.dataset.source;
    node.removeAttribute("data-processed");
  }
  try {
    await mermaid.run({ nodes });
    disableMermaidNativeTooltips(container);
  } catch (error) {
    console.warn("Mermaid render failed", error);
  }
};
