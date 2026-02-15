import { allEventsUrl, rootEventsUrl } from "./api";

export type RootChangedEvent = {
  kind: "changed";
  rootId: string;
  prdId: string | null;
  at: string;
};

export type ActivePlanSelection = {
  rootId: string;
  prdId: string;
} | null;

export type RootEventsSubscription = {
  close: () => void;
};

type IdleResolver = () => void;

export const isActivePlanAffected = (selection: ActivePlanSelection, event: RootChangedEvent) => {
  if (!selection) return false;
  if (selection.rootId !== event.rootId) return false;
  if (event.prdId === null) return true;
  return selection.prdId === event.prdId;
};

export const shouldReloadActivePlanFromEvents = (
  selection: ActivePlanSelection,
  events: RootChangedEvent[],
) => {
  return events.some((event) => isActivePlanAffected(selection, event));
};

const normalizeRootChangedEvent = (
  input: unknown,
  fallbackRootId?: string,
): RootChangedEvent | null => {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { kind?: unknown; rootId?: unknown; prdId?: unknown; at?: unknown };
  if (candidate.kind !== "changed") return null;
  const normalizedFallbackRootId =
    typeof fallbackRootId === "string" && fallbackRootId.trim().length > 0 ? fallbackRootId : null;
  const rootId =
    typeof candidate.rootId === "string" && candidate.rootId.trim().length > 0
      ? candidate.rootId
      : normalizedFallbackRootId;
  if (!rootId) return null;
  const prdId =
    typeof candidate.prdId === "string" && candidate.prdId.trim().length > 0
      ? candidate.prdId
      : null;
  const at = typeof candidate.at === "string" ? candidate.at : new Date().toISOString();
  return { kind: "changed", rootId, prdId, at };
};

export const parseRootChangedEvent = (
  raw: string,
  fallbackRootId?: string,
): RootChangedEvent | null => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeRootChangedEvent(parsed, fallbackRootId);
  } catch {
    return null;
  }
};

export const createRootEventsSubscription = (
  rootId: string,
  onChanged: (event: RootChangedEvent) => void,
  onError?: (error: Event) => void,
): RootEventsSubscription => {
  return createEventsSubscription(rootEventsUrl(rootId), onChanged, onError, rootId);
};

export const createGlobalEventsSubscription = (
  onChanged: (event: RootChangedEvent) => void,
  onError?: (error: Event) => void,
): RootEventsSubscription => {
  return createEventsSubscription(allEventsUrl(), onChanged, onError);
};

const createEventsSubscription = (
  url: string,
  onChanged: (event: RootChangedEvent) => void,
  onError?: (error: Event) => void,
  fallbackRootId?: string,
): RootEventsSubscription => {
  const source = new EventSource(url);
  const handleEvent = (event: Event) => {
    const payload = parseRootChangedEvent((event as MessageEvent).data, fallbackRootId);
    if (!payload) return;
    onChanged(payload);
  };

  const handleError = (event: Event) => {
    onError?.(event);
  };

  source.addEventListener("changed", handleEvent as EventListener);
  source.addEventListener("message", handleEvent as EventListener);
  source.addEventListener("error", handleError as EventListener);

  return {
    close: () => {
      source.removeEventListener("changed", handleEvent as EventListener);
      source.removeEventListener("message", handleEvent as EventListener);
      source.removeEventListener("error", handleError as EventListener);
      source.close();
    },
  };
};

export const reconcileRootSubscriptions = (
  existing: Map<string, RootEventsSubscription>,
  rootIds: string[],
  create: (rootId: string) => RootEventsSubscription,
) => {
  const uniqueRootIds = new Set(rootIds);
  for (const [rootId, subscription] of existing) {
    if (uniqueRootIds.has(rootId)) continue;
    subscription.close();
    existing.delete(rootId);
  }
  for (const rootId of uniqueRootIds) {
    if (existing.has(rootId)) continue;
    existing.set(rootId, create(rootId));
  }
  return existing;
};

export const createCoalescedAsyncRunner = (run: () => Promise<void>) => {
  let pending = false;
  let running = false;
  const idleResolvers: IdleResolver[] = [];

  const resolveIdle = () => {
    if (running || pending) return;
    while (idleResolvers.length > 0) {
      const resolver = idleResolvers.shift();
      resolver?.();
    }
  };

  const trigger = () => {
    pending = true;
    if (running) return;
    running = true;
    void (async () => {
      try {
        while (pending) {
          pending = false;
          await run();
        }
      } finally {
        running = false;
        resolveIdle();
      }
    })();
  };

  const waitForIdle = () => {
    if (!running && !pending) return Promise.resolve();
    return new Promise<void>((resolve) => {
      idleResolvers.push(resolve);
    });
  };

  return {
    trigger,
    waitForIdle,
    isRunning: () => running,
  };
};
