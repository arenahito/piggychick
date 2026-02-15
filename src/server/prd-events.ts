import { watch, type FSWatcher } from "node:fs";
import { lstat, readdir, realpath } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import { resolveConfigPath } from "../shared/config";
import {
  inferPrdIdFromWatchPath,
  listRootIds,
  listRootWatchTargetsByRootId,
  type RootWatchTarget,
} from "./tasks";

const debounceMs = 200;
const keepaliveMs = 5_000;

export type RootChangedEvent = {
  kind: "changed";
  rootId: string;
  prdId: string | null;
  at: string;
};

type Subscriber = (event: RootChangedEvent) => void;

type RootEventEntry = {
  rootId: string;
  targets: RootWatchTarget[];
  watchers: FSWatcher[];
  subscribers: Set<Subscriber>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  pendingPrdIds: Set<string>;
  ambiguousPrd: boolean;
};

const rootEntries = new Map<string, RootEventEntry>();
const rootEntryInits = new Map<string, Promise<RootEventEntry>>();

const toRelativePath = (filename: string | Buffer | null | undefined) => {
  if (typeof filename === "string") return filename;
  if (filename instanceof Buffer) return filename.toString("utf8");
  return null;
};

const isRelevantPath = (
  eventType: "rename" | "change",
  relativePath: string | null,
  inferredPrdId: string | null,
) => {
  if (!relativePath) return true;
  const normalized = relativePath.replace(/\\/g, "/").trim();
  if (!normalized) return true;
  const fileName = basename(normalized).toLowerCase();
  if (fileName === "plan.json" || fileName === "plan.md" || fileName.endsWith(".md")) {
    return true;
  }
  if (inferredPrdId !== null && !normalized.includes("/")) {
    return true;
  }
  if (eventType === "rename" && inferredPrdId !== null) {
    return true;
  }
  return false;
};

const formatChangedEvent = (event: RootChangedEvent) => {
  return `event: changed\ndata: ${JSON.stringify(event)}\n\n`;
};

const closeEntryIfUnused = (rootId: string) => {
  const entry = rootEntries.get(rootId);
  if (!entry || entry.subscribers.size > 0) return;
  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
    entry.debounceTimer = null;
  }
  for (const watcher of entry.watchers) {
    try {
      watcher.close();
    } catch {
      continue;
    }
  }
  rootEntries.delete(rootId);
};

const flushRootEvent = (entry: RootEventEntry) => {
  entry.debounceTimer = null;
  if (entry.subscribers.size === 0) {
    entry.pendingPrdIds.clear();
    entry.ambiguousPrd = false;
    return;
  }
  const prdId =
    !entry.ambiguousPrd && entry.pendingPrdIds.size === 1 ? [...entry.pendingPrdIds][0] : null;
  const payload: RootChangedEvent = {
    kind: "changed",
    rootId: entry.rootId,
    prdId,
    at: new Date().toISOString(),
  };
  entry.pendingPrdIds.clear();
  entry.ambiguousPrd = false;
  for (const subscriber of entry.subscribers) {
    try {
      subscriber(payload);
    } catch {
      continue;
    }
  }
};

const scheduleRootFlush = (entry: RootEventEntry) => {
  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
  }
  entry.debounceTimer = setTimeout(() => flushRootEvent(entry), debounceMs);
};

const registerFileEvent = (
  entry: RootEventEntry,
  target: RootWatchTarget,
  eventType: "rename" | "change",
  filename: string | Buffer | null | undefined,
) => {
  const relativePath = toRelativePath(filename);
  const inferredPrdId =
    relativePath === null ? null : inferPrdIdFromWatchPath(target, relativePath);
  if (!isRelevantPath(eventType, relativePath, inferredPrdId)) {
    return;
  }
  if (inferredPrdId === null) {
    entry.ambiguousPrd = true;
  } else {
    entry.pendingPrdIds.add(inferredPrdId);
  }
  scheduleRootFlush(entry);
};

const openRecursiveWatcher = (
  target: RootWatchTarget,
  onEvent: (eventType: "rename" | "change", filename: string | Buffer | null) => void,
) => {
  try {
    return watch(target.path, { recursive: true }, onEvent);
  } catch {
    return null;
  }
};

const createFallbackWatchers = async (
  entry: RootEventEntry,
  target: RootWatchTarget,
): Promise<FSWatcher[]> => {
  const watchers: FSWatcher[] = [];
  const childWatchers = new Map<string, FSWatcher>();
  const targetRoot = await realpath(target.path).catch(() => target.path);
  let syncInFlight = false;
  let syncQueued = false;

  const syncChildWatchersOnce = async () => {
    const directoryEntries = await readdir(target.path, { withFileTypes: true }).catch(() => null);
    if (!directoryEntries) return;
    const nextChildren = new Set<string>();
    for (const directoryEntry of directoryEntries) {
      if (!directoryEntry.isDirectory() || directoryEntry.isSymbolicLink()) continue;
      const childName = String(directoryEntry.name);
      if (inferPrdIdFromWatchPath(target, childName) === null) continue;
      nextChildren.add(childName);
      if (childWatchers.has(childName)) continue;
      const childPath = join(target.path, childName);
      const childStats = await lstat(childPath).catch(() => null);
      if (!childStats || !childStats.isDirectory() || childStats.isSymbolicLink()) continue;
      const childRealPath = await realpath(childPath).catch(() => null);
      if (
        !childRealPath ||
        (!childRealPath.startsWith(targetRoot + sep) && childRealPath !== targetRoot)
      ) {
        continue;
      }
      let childWatcher: FSWatcher | null = null;
      try {
        childWatcher = watch(childRealPath, (eventType, filename) => {
          const relativeLeaf = toRelativePath(filename);
          const relativePath = relativeLeaf ? `${childName}/${relativeLeaf}` : childName;
          registerFileEvent(entry, target, eventType, relativePath);
        });
      } catch {
        childWatcher = null;
      }
      if (!childWatcher) continue;
      childWatchers.set(childName, childWatcher);
      watchers.push(childWatcher);
    }
    for (const [childName, childWatcher] of childWatchers) {
      if (nextChildren.has(childName)) continue;
      try {
        childWatcher.close();
      } catch {
        continue;
      } finally {
        childWatchers.delete(childName);
      }
    }
  };

  const syncChildWatchers = async () => {
    if (syncInFlight) {
      syncQueued = true;
      return;
    }
    syncInFlight = true;
    try {
      do {
        syncQueued = false;
        await syncChildWatchersOnce();
      } while (syncQueued);
    } finally {
      syncInFlight = false;
    }
  };

  let rootWatcher: FSWatcher | null = null;
  try {
    rootWatcher = watch(target.path, (eventType, filename) => {
      registerFileEvent(entry, target, eventType, filename);
      void syncChildWatchers();
    });
  } catch {
    rootWatcher = null;
  }
  if (!rootWatcher) return watchers;

  watchers.push(rootWatcher);
  await syncChildWatchers();
  return watchers;
};

const createTargetWatchers = async (entry: RootEventEntry, target: RootWatchTarget) => {
  const recursiveWatcher = openRecursiveWatcher(target, (eventType, filename) => {
    registerFileEvent(entry, target, eventType, filename);
  });
  if (recursiveWatcher) {
    return [recursiveWatcher];
  }
  return createFallbackWatchers(entry, target);
};

const initRootEntry = async (rootId: string, configPath: string) => {
  const targets = await listRootWatchTargetsByRootId(rootId, configPath);
  const entry: RootEventEntry = {
    rootId,
    targets,
    watchers: [],
    subscribers: new Set(),
    debounceTimer: null,
    pendingPrdIds: new Set(),
    ambiguousPrd: false,
  };
  for (const target of targets) {
    const watchers = await createTargetWatchers(entry, target);
    entry.watchers.push(...watchers);
  }
  rootEntries.set(rootId, entry);
  return entry;
};

const getOrCreateRootEntry = async (rootId: string, configPath: string) => {
  const existing = rootEntries.get(rootId);
  if (existing) return existing;
  const pending = rootEntryInits.get(rootId);
  if (pending) return pending;
  const init = initRootEntry(rootId, configPath).finally(() => {
    rootEntryInits.delete(rootId);
  });
  rootEntryInits.set(rootId, init);
  return init;
};

const attachSubscriberToRoots = async (
  rootIds: string[],
  configPath: string,
  isClosed: () => boolean,
  subscriber: Subscriber,
  attachedRootIds: Set<string>,
) => {
  for (const rootId of rootIds) {
    if (isClosed()) {
      return;
    }
    if (attachedRootIds.has(rootId)) {
      continue;
    }
    let entry: RootEventEntry | null = null;
    try {
      entry = await getOrCreateRootEntry(rootId, configPath);
    } catch {
      entry = null;
    }
    if (!entry || isClosed()) {
      continue;
    }
    entry.subscribers.add(subscriber);
    attachedRootIds.add(rootId);
  }
};

export const createRootEventsResponse = async (
  request: Request,
  rootId: string,
  configPath = resolveConfigPath(),
) => {
  const entry = await getOrCreateRootEntry(rootId, configPath);
  const encoder = new TextEncoder();
  let closed = false;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let removeAbort: (() => void) | null = null;
  let subscriber: Subscriber | null = null;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepalive) {
          clearInterval(keepalive);
          keepalive = null;
        }
        if (subscriber) {
          entry.subscribers.delete(subscriber);
          subscriber = null;
        }
        if (removeAbort) {
          removeAbort();
          removeAbort = null;
        }
        closeEntryIfUnused(rootId);
        try {
          controller.close();
        } catch {
          return;
        }
      };

      subscriber = (event) => {
        if (closed) return;
        try {
          send(formatChangedEvent(event));
        } catch {
          cleanup();
        }
      };

      entry.subscribers.add(subscriber);
      if (request.signal.aborted) {
        cleanup();
        return;
      }
      send(": connected\n\n");
      keepalive = setInterval(() => {
        if (closed) return;
        try {
          send(": keepalive\n\n");
        } catch {
          cleanup();
        }
      }, keepaliveMs);

      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });
      removeAbort = () => request.signal.removeEventListener("abort", onAbort);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const createGlobalEventsResponse = async (
  request: Request,
  configPath = resolveConfigPath(),
) => {
  const encoder = new TextEncoder();
  let closed = false;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let removeAbort: (() => void) | null = null;
  const attachedRootIds = new Set<string>();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      const subscriber: Subscriber = (event) => {
        if (closed) return;
        try {
          send(formatChangedEvent(event));
        } catch {
          cleanup();
        }
      };
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepalive) {
          clearInterval(keepalive);
          keepalive = null;
        }
        for (const rootId of attachedRootIds) {
          const entry = rootEntries.get(rootId);
          if (!entry) continue;
          entry.subscribers.delete(subscriber);
          closeEntryIfUnused(rootId);
        }
        attachedRootIds.clear();
        if (removeAbort) {
          removeAbort();
          removeAbort = null;
        }
        try {
          controller.close();
        } catch {
          return;
        }
      };

      if (request.signal.aborted) {
        cleanup();
        return;
      }
      send(": connected\n\n");
      keepalive = setInterval(() => {
        if (closed) return;
        try {
          send(": keepalive\n\n");
        } catch {
          cleanup();
        }
      }, keepaliveMs);

      const onAbort = () => cleanup();
      request.signal.addEventListener("abort", onAbort, { once: true });
      removeAbort = () => request.signal.removeEventListener("abort", onAbort);

      void (async () => {
        const rootIds = await listRootIds(configPath).catch(() => []);
        await attachSubscriberToRoots(
          rootIds,
          configPath,
          () => closed,
          subscriber,
          attachedRootIds,
        );
      })().catch(() => {
        cleanup();
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

export const getRootEventsDebugSnapshot = () => {
  let watcherCount = 0;
  let subscriberCount = 0;
  for (const entry of rootEntries.values()) {
    watcherCount += entry.watchers.length;
    subscriberCount += entry.subscribers.size;
  }
  return {
    roots: rootEntries.size,
    watchers: watcherCount,
    subscribers: subscriberCount,
  };
};

export const emitSyntheticRootChangeForTests = (
  rootId: string,
  relativePath: string | null,
  eventType: "rename" | "change" = "change",
) => {
  const entry = rootEntries.get(rootId);
  if (!entry) return false;
  const target = entry.targets[0];
  if (!target) return false;
  registerFileEvent(entry, target, eventType, relativePath);
  return true;
};

export const resetRootEventsForTests = () => {
  for (const [rootId] of rootEntries) {
    closeEntryIfUnused(rootId);
  }
  for (const entry of rootEntries.values()) {
    for (const watcher of entry.watchers) {
      try {
        watcher.close();
      } catch {
        continue;
      }
    }
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
      entry.debounceTimer = null;
    }
    entry.subscribers.clear();
  }
  rootEntries.clear();
  rootEntryInits.clear();
};
