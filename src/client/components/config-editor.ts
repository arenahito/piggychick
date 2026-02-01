export type ConfigToastVariant = "success" | "error" | "warning";

export type ConfigToastState = {
  message: string;
  variant: ConfigToastVariant;
} | null;

export type ConfigEditorOptions = {
  path: string;
  text: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export type ConfigEditorHandle = {
  setSaving: (saving: boolean) => void;
  setToast: (toast: ConfigToastState) => void;
  setText: (text: string) => void;
  focus: () => void;
};

export const renderConfigEditor = (
  container: HTMLElement,
  options: ConfigEditorOptions,
): ConfigEditorHandle => {
  container.innerHTML = "";

  const wrapper = document.createElement("section");
  wrapper.className = "config-editor";

  const header = document.createElement("div");
  header.className = "config-editor-header";

  const title = document.createElement("div");
  title.className = "config-editor-title";
  title.textContent = "Config Editor";

  const path = document.createElement("div");
  path.className = "config-editor-path";
  path.textContent = options.path;

  header.append(title, path);

  const body = document.createElement("div");
  body.className = "config-editor-body";

  const surface = document.createElement("div");
  surface.className = "config-editor-surface";

  const highlight = document.createElement("pre");
  highlight.className = "config-editor-highlight";
  highlight.setAttribute("aria-hidden", "true");

  const textarea = document.createElement("textarea");
  textarea.className = "config-editor-input";
  textarea.value = options.text;
  textarea.wrap = "off";
  textarea.spellcheck = false;
  textarea.setAttribute("aria-label", "Config file");

  let rafHandle: number | null = null;
  const scheduleHighlight = () => {
    if (rafHandle !== null) return;
    rafHandle = window.requestAnimationFrame(() => {
      rafHandle = null;
      highlight.innerHTML = renderHighlight(textarea.value);
      syncScroll();
    });
  };

  const syncScroll = () => {
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  };

  textarea.addEventListener("input", (event) => {
    const target = event.target as HTMLTextAreaElement;
    options.onChange(target.value);
    scheduleHighlight();
  });
  textarea.addEventListener("scroll", () => {
    syncScroll();
  });

  highlight.innerHTML = renderHighlight(textarea.value);
  syncScroll();

  surface.append(highlight, textarea);
  body.append(surface);

  const footer = document.createElement("div");
  footer.className = "config-editor-footer";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "config-editor-button config-editor-cancel";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => options.onCancel());

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "config-editor-button config-editor-save";
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", () => options.onSave());

  footer.append(cancelButton, saveButton);

  const toast = document.createElement("div");
  toast.className = "config-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.dataset.state = "hidden";

  wrapper.append(header, toast, body, footer);
  container.append(wrapper);

  const setSaving = (saving: boolean) => {
    saveButton.disabled = saving;
    cancelButton.disabled = saving;
    textarea.readOnly = saving;
  };

  const setToast = (state: ConfigToastState) => {
    if (!state) {
      toast.textContent = "";
      toast.dataset.state = "hidden";
      toast.dataset.variant = "";
      toast.setAttribute("aria-live", "polite");
      return;
    }
    toast.textContent = state.message;
    toast.dataset.state = "visible";
    toast.dataset.variant = state.variant;
    toast.setAttribute("aria-live", state.variant === "error" ? "assertive" : "polite");
  };

  const setText = (text: string) => {
    textarea.value = text;
    highlight.innerHTML = renderHighlight(textarea.value);
    syncScroll();
  };

  setSaving(options.isSaving);

  return {
    setSaving,
    setToast,
    setText,
    focus: () => textarea.focus(),
  };
};

const renderHighlight = (text: string) => {
  const tokens = tokenizeJsonc(text);
  return tokens
    .map((token) => {
      const escaped = escapeHtml(token.value);
      if (token.type === "plain") {
        return escaped;
      }
      return `<span class="config-token config-token-${token.type}">${escaped}</span>`;
    })
    .join("");
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

type Token = {
  type: "plain" | "comment" | "string" | "number" | "boolean" | "null" | "punct";
  value: string;
};

const tokenizeJsonc = (input: string): Token[] => {
  const tokens: Token[] = [];
  const push = (type: Token["type"], value: string) => {
    if (!value) return;
    tokens.push({ type, value });
  };

  let i = 0;
  while (i < input.length) {
    const char = input[i];
    const next = input[i + 1];

    if (char === "/" && next === "/") {
      const start = i;
      i += 2;
      while (i < input.length && input[i] !== "\n") {
        i += 1;
      }
      push("comment", input.slice(start, i));
      continue;
    }

    if (char === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < input.length) {
        if (input[i] === "*" && input[i + 1] === "/") {
          i += 2;
          break;
        }
        i += 1;
      }
      push("comment", input.slice(start, i));
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      i += 1;
      let escaped = false;
      while (i < input.length) {
        const current = input[i];
        if (escaped) {
          escaped = false;
        } else if (current === "\\") {
          escaped = true;
        } else if (current === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      push("string", input.slice(start, i));
      continue;
    }

    if ((char === "-" && /[0-9]/.test(next ?? "")) || /[0-9]/.test(char)) {
      const match = input.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match) {
        push("number", match[0]);
        i += match[0].length;
        continue;
      }
    }

    if (/[A-Za-z]/.test(char)) {
      const start = i;
      i += 1;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) {
        i += 1;
      }
      const word = input.slice(start, i);
      if (word === "true" || word === "false") {
        push("boolean", word);
      } else if (word === "null") {
        push("null", word);
      } else {
        push("plain", word);
      }
      continue;
    }

    if (
      char === "{" ||
      char === "}" ||
      char === "[" ||
      char === "]" ||
      char === ":" ||
      char === ","
    ) {
      push("punct", char);
      i += 1;
      continue;
    }

    push("plain", char);
    i += 1;
  }

  return tokens;
};

export const renderConfigEditorError = (
  container: HTMLElement,
  message: string,
  onRetry: () => void,
  onCancel: () => void,
) => {
  container.innerHTML = "";

  const wrapper = document.createElement("section");
  wrapper.className = "config-editor-error";

  const text = document.createElement("div");
  text.className = "config-editor-error-message";
  text.textContent = message;

  const actions = document.createElement("div");
  actions.className = "config-editor-error-actions";

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "config-editor-button config-editor-retry";
  retryButton.textContent = "Retry";
  retryButton.addEventListener("click", () => onRetry());

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "config-editor-button config-editor-cancel";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => onCancel());

  actions.append(retryButton, cancelButton);
  wrapper.append(text, actions);
  container.append(wrapper);
};
