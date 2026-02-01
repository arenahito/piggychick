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

  const textarea = document.createElement("textarea");
  textarea.className = "config-editor-input";
  textarea.value = options.text;
  textarea.spellcheck = false;
  textarea.setAttribute("aria-label", "Config file");
  textarea.addEventListener("input", (event) => {
    const target = event.target as HTMLTextAreaElement;
    options.onChange(target.value);
  });

  body.append(textarea);

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
  };

  setSaving(options.isSaving);

  return {
    setSaving,
    setToast,
    setText,
    focus: () => textarea.focus(),
  };
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
