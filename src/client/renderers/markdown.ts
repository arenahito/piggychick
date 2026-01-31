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
  } catch (error) {
    console.warn("Mermaid render failed", error);
  }
};
