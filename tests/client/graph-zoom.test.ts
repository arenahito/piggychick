import { describe, expect, test } from "bun:test";
import {
  clampGraphZoomScale,
  createDefaultGraphZoomState,
  createGraphTransform,
  didGraphDragExceedThreshold,
  formatGraphZoomPercent,
  GRAPH_DRAG_CLICK_THRESHOLD_PX,
  GRAPH_ZOOM_MAX_SCALE,
  GRAPH_ZOOM_MIN_SCALE,
  zoomGraphByStepAtPoint,
  zoomGraphToScaleAtPoint,
  panGraphByDelta,
} from "../../src/client/components/graph-zoom";

describe("graph zoom utilities", () => {
  test("creates default state", () => {
    expect(createDefaultGraphZoomState()).toEqual({
      scale: 1,
      translateX: 0,
      translateY: 0,
    });
  });

  test("clamps scale to bounds", () => {
    expect(clampGraphZoomScale(0.1)).toBe(GRAPH_ZOOM_MIN_SCALE);
    expect(clampGraphZoomScale(8)).toBe(GRAPH_ZOOM_MAX_SCALE);
    expect(clampGraphZoomScale(1.4)).toBe(1.4);
  });

  test("preserves focal point when zooming to scale", () => {
    const before = { scale: 1.2, translateX: 42, translateY: -18 };
    const focal = { x: 280, y: 150 };
    const worldX = (focal.x - before.translateX) / before.scale;
    const worldY = (focal.y - before.translateY) / before.scale;

    const after = zoomGraphToScaleAtPoint(before, 2.1, focal);
    const projectedX = worldX * after.scale + after.translateX;
    const projectedY = worldY * after.scale + after.translateY;

    expect(projectedX).toBeCloseTo(focal.x, 10);
    expect(projectedY).toBeCloseTo(focal.y, 10);
  });

  test("zooms by step and respects bounds over repeated operations", () => {
    let state = createDefaultGraphZoomState();
    for (let index = 0; index < 40; index += 1) {
      state = zoomGraphByStepAtPoint(state, 1, { x: 0, y: 0 });
    }
    expect(state.scale).toBe(GRAPH_ZOOM_MAX_SCALE);

    for (let index = 0; index < 80; index += 1) {
      state = zoomGraphByStepAtPoint(state, -1, { x: 0, y: 0 });
    }
    expect(state.scale).toBe(GRAPH_ZOOM_MIN_SCALE);
  });

  test("handles extreme focal coordinates without invalid numbers", () => {
    const state = createDefaultGraphZoomState();
    const next = zoomGraphToScaleAtPoint(state, 2, { x: 1000000, y: -1000000 });
    expect(Number.isFinite(next.translateX)).toBe(true);
    expect(Number.isFinite(next.translateY)).toBe(true);
    expect(Number.isFinite(next.scale)).toBe(true);
  });

  test("applies pan deltas", () => {
    const state = panGraphByDelta({ scale: 1.5, translateX: 10, translateY: -20 }, 7, -3);
    expect(state).toEqual({ scale: 1.5, translateX: 17, translateY: -23 });
  });

  test("formats percentage and transform string", () => {
    expect(formatGraphZoomPercent(1.56)).toBe("156%");
    expect(createGraphTransform({ scale: 1.25, translateX: 30, translateY: -12 })).toBe(
      "translate(30px, -12px) scale(1.25)",
    );
  });

  test("classifies drag threshold correctly", () => {
    expect(didGraphDragExceedThreshold(2, 2)).toBe(false);
    expect(
      didGraphDragExceedThreshold(GRAPH_DRAG_CLICK_THRESHOLD_PX, 0, GRAPH_DRAG_CLICK_THRESHOLD_PX),
    ).toBe(false);
    expect(
      didGraphDragExceedThreshold(
        GRAPH_DRAG_CLICK_THRESHOLD_PX + 0.1,
        0,
        GRAPH_DRAG_CLICK_THRESHOLD_PX,
      ),
    ).toBe(true);
  });
});
