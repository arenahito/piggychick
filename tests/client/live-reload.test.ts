import { afterEach, describe, expect, test } from "bun:test";
import {
  createCoalescedAsyncRunner,
  createGlobalEventsSubscription,
  createRootEventsSubscription,
  isActivePlanAffected,
  parseRootChangedEvent,
  reconcileRootSubscriptions,
  shouldReloadActivePlanFromEvents,
  type RootChangedEvent,
  type RootEventsSubscription,
} from "../../src/client/live-reload";

type Listener = (event: Event) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed: boolean;
  private listeners: Map<string, Set<Listener>>;

  constructor(url: string) {
    this.url = url;
    this.closed = false;
    this.listeners = new Map();
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data?: string) {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    const event = { data } satisfies Partial<MessageEvent> as MessageEvent;
    for (const listener of listeners) {
      listener(event as unknown as Event);
    }
  }
}

const originalEventSource = globalThis.EventSource;

afterEach(() => {
  globalThis.EventSource = originalEventSource;
  FakeEventSource.instances = [];
});

describe("live reload helpers", () => {
  test("parses changed events safely", () => {
    const parsed = parseRootChangedEvent(
      JSON.stringify({
        kind: "changed",
        rootId: "root",
        prdId: "alpha",
        at: "2026-02-11T00:00:00.000Z",
      }),
      "fallback",
    );
    expect(parsed).toEqual({
      kind: "changed",
      rootId: "root",
      prdId: "alpha",
      at: "2026-02-11T00:00:00.000Z",
    });
    expect(parseRootChangedEvent("{}", "fallback")).toBeNull();
    expect(parseRootChangedEvent("{", "fallback")).toBeNull();
    const emptyPrd = parseRootChangedEvent(
      JSON.stringify({ kind: "changed", rootId: "root", prdId: "" }),
      "fallback",
    );
    expect(emptyPrd?.prdId).toBeNull();
    expect(parseRootChangedEvent(JSON.stringify({ kind: "changed", prdId: "alpha" }))).toBeNull();
  });

  test("detects whether active plan should reload", () => {
    const selection = { rootId: "root-a", prdId: "alpha" };
    const samePrd: RootChangedEvent = {
      kind: "changed",
      rootId: "root-a",
      prdId: "alpha",
      at: "2026-02-11T00:00:00.000Z",
    };
    const unknownPrd: RootChangedEvent = {
      kind: "changed",
      rootId: "root-a",
      prdId: null,
      at: "2026-02-11T00:00:01.000Z",
    };
    const differentRoot: RootChangedEvent = {
      kind: "changed",
      rootId: "root-b",
      prdId: "alpha",
      at: "2026-02-11T00:00:02.000Z",
    };
    expect(isActivePlanAffected(selection, samePrd)).toBe(true);
    expect(isActivePlanAffected(selection, unknownPrd)).toBe(true);
    expect(isActivePlanAffected(selection, differentRoot)).toBe(false);
    expect(isActivePlanAffected(null, samePrd)).toBe(false);
    expect(shouldReloadActivePlanFromEvents(selection, [differentRoot, samePrd])).toBe(true);
    expect(shouldReloadActivePlanFromEvents({ rootId: "root-a", prdId: "beta" }, [samePrd])).toBe(
      false,
    );
  });

  test("subscribes to root events and stops dispatch after close", () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
    const received: RootChangedEvent[] = [];
    const errors: Event[] = [];
    const subscription = createRootEventsSubscription(
      "root/with space",
      (event) => {
        received.push(event);
      },
      (event) => {
        errors.push(event);
      },
    );

    const source = FakeEventSource.instances[0];
    if (!source) throw new Error("Missing fake event source");
    expect(source.url).toBe("/api/roots/root%2Fwith%20space/events");

    source.emit(
      "changed",
      JSON.stringify({
        kind: "changed",
        rootId: "root/with space",
        prdId: "alpha",
        at: "2026-02-11T01:00:00.000Z",
      }),
    );
    source.emit(
      "message",
      JSON.stringify({
        kind: "changed",
        rootId: "root/with space",
        prdId: null,
        at: "2026-02-11T01:00:01.000Z",
      }),
    );
    source.emit("changed", "not-json");
    source.emit("error");

    expect(received).toEqual([
      {
        kind: "changed",
        rootId: "root/with space",
        prdId: "alpha",
        at: "2026-02-11T01:00:00.000Z",
      },
      {
        kind: "changed",
        rootId: "root/with space",
        prdId: null,
        at: "2026-02-11T01:00:01.000Z",
      },
    ]);
    expect(errors).toHaveLength(1);

    subscription.close();
    source.emit(
      "changed",
      JSON.stringify({
        kind: "changed",
        rootId: "root/with space",
        prdId: "beta",
        at: "2026-02-11T01:00:02.000Z",
      }),
    );
    expect(received).toHaveLength(2);
    expect(source.closed).toBe(true);
  });

  test("subscribes to all-root events with a single endpoint", () => {
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
    const received: RootChangedEvent[] = [];
    const subscription = createGlobalEventsSubscription((event) => {
      received.push(event);
    });

    const source = FakeEventSource.instances[0];
    if (!source) throw new Error("Missing fake event source");
    expect(source.url).toBe("/api/events");

    source.emit(
      "changed",
      JSON.stringify({
        kind: "changed",
        rootId: "root-a",
        prdId: "alpha",
        at: "2026-02-11T01:10:00.000Z",
      }),
    );
    source.emit(
      "message",
      JSON.stringify({
        kind: "changed",
        rootId: "root-b",
        prdId: null,
        at: "2026-02-11T01:10:01.000Z",
      }),
    );
    source.emit("changed", JSON.stringify({ kind: "changed", prdId: "missing-root-id" }));

    expect(received).toEqual([
      {
        kind: "changed",
        rootId: "root-a",
        prdId: "alpha",
        at: "2026-02-11T01:10:00.000Z",
      },
      {
        kind: "changed",
        rootId: "root-b",
        prdId: null,
        at: "2026-02-11T01:10:01.000Z",
      },
    ]);

    subscription.close();
    expect(source.closed).toBe(true);
  });

  test("reconciles root subscriptions by closing removed roots", () => {
    const closed: string[] = [];
    const existing = new Map<string, RootEventsSubscription>([
      ["a", { close: () => closed.push("a") }],
      ["b", { close: () => closed.push("b") }],
    ]);
    const created: string[] = [];
    const reconciled = reconcileRootSubscriptions(existing, ["b", "c"], (rootId) => {
      created.push(rootId);
      return { close: () => closed.push(rootId) };
    });
    expect([...reconciled.keys()]).toEqual(["b", "c"]);
    expect(created).toEqual(["c"]);
    expect(closed).toEqual(["a"]);
  });

  test("coalesces async refresh triggers", async () => {
    let runCount = 0;
    let runner: ReturnType<typeof createCoalescedAsyncRunner> | null = null;
    runner = createCoalescedAsyncRunner(async () => {
      runCount += 1;
      if (runCount === 1) {
        runner?.trigger();
        runner?.trigger();
      }
      await Bun.sleep(5);
    });

    runner.trigger();
    await runner.waitForIdle();
    expect(runCount).toBe(2);
    expect(runner.isRunning()).toBe(false);
  });
});
