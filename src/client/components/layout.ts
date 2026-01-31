export type Layout = {
  root: HTMLDivElement;
  sidebarContent: HTMLElement;
  content: HTMLElement;
  contentBody: HTMLElement;
  mobileSelect: HTMLSelectElement;
};

export const createLayout = (): Layout => {
  const root = document.createElement("div");
  root.className = "app-shell";

  const mobileSelect = document.createElement("select");
  mobileSelect.className = "app-mobile-select";
  mobileSelect.id = "app-mobile-select";
  mobileSelect.name = "app-mobile-select";
  mobileSelect.setAttribute("aria-label", "Select PRD view");

  const body = document.createElement("div");
  body.className = "app-body";

  const sidebar = document.createElement("aside");
  sidebar.className = "app-sidebar";

  const sidebarContent = document.createElement("div");
  sidebarContent.className = "sidebar-content";

  sidebar.append(sidebarContent);

  const content = document.createElement("main");
  content.className = "app-content";

  const mobileBar = document.createElement("div");
  mobileBar.className = "app-mobile-bar";
  mobileBar.append(mobileSelect);

  const contentBody = document.createElement("div");
  contentBody.className = "app-content-body";

  content.append(mobileBar, contentBody);
  body.append(sidebar, content);
  root.append(body);

  return { root, sidebarContent, content, contentBody, mobileSelect };
};
