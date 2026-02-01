import { lstat, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import open from "open";
import { handleApiRequest } from "./routes";

export type ServerOptions = {
  configPath: string;
  distRoot: string;
  port?: number;
  openBrowser?: boolean;
};

const notFoundHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
};

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

const resolveContentType = (pathname: string) => {
  const match = pathname.match(/\.[a-z0-9]+$/i);
  if (!match) return "application/octet-stream";
  return contentTypes[match[0]] ?? "application/octet-stream";
};

const shouldCache = (pathname: string) => {
  if (pathname.startsWith("/assets/")) return true;
  const match = pathname.match(/\.[a-z0-9]+$/i);
  if (!match) return false;
  return match[0] !== ".html";
};

export const startServer = async (options: ServerOptions) => {
  const port = Number(options.port ?? process.env.PGCH_PORT ?? 3000);
  const configPath = options.configPath;
  const distRoot = resolve(options.distRoot);
  const distRootReal = await realpath(distRoot).catch(() => distRoot);

  const isWithinRoot = (path: string) => {
    return path.startsWith(distRootReal + sep) || path === distRootReal;
  };

  const serveIndex = async () => {
    const indexPath = resolve(distRootReal, "index.html");
    const indexReal = await realpath(indexPath).catch(() => null);
    if (indexReal && isWithinRoot(indexReal)) {
      return new Response(Bun.file(indexReal), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    const fallback =
      '<!doctype html><html><head><meta charset="utf-8" /><title>PiggyChick</title></head><body><div id="app">Build the client to see the UI.</div></body></html>';
    return new Response(fallback, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  };

  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return handleApiRequest(request, configPath);
      }
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const candidate = resolve(distRootReal, pathname.slice(1));
      if (!isWithinRoot(candidate)) {
        return new Response("Not Found", { status: 404, headers: notFoundHeaders });
      }

      const realFile = await realpath(candidate).catch(() => null);
      if (!realFile) {
        return serveIndex();
      }
      if (!isWithinRoot(realFile)) {
        return new Response("Not Found", { status: 404, headers: notFoundHeaders });
      }
      const stats = await lstat(realFile).catch(() => null);
      if (!stats || stats.isDirectory()) {
        return serveIndex();
      }
      const headers: Record<string, string> = {
        "Content-Type": resolveContentType(pathname),
      };
      if (shouldCache(pathname)) {
        headers["Cache-Control"] = "public, max-age=60";
      }
      return new Response(Bun.file(realFile), { headers });
    },
  });

  const shouldOpenBrowser = options.openBrowser ?? true;

  const openBrowser = async () => {
    if (process.env.PGCH_OPEN_BROWSER === "0") return;
    const delayMs = Number(process.env.PGCH_OPEN_DELAY_MS ?? 1000);
    if (Number.isFinite(delayMs) && delayMs > 0) {
      await Bun.sleep(delayMs);
    }
    const url = `http://localhost:${server.port}`;
    const child = await open(url, { wait: false, background: true });
    child?.unref?.();
    await Bun.sleep(250);
  };

  if (shouldOpenBrowser) {
    openBrowser().catch(() => {});
  }

  console.log(`Server running at http://localhost:${server.port}`);

  return { server, port: server.port };
};
