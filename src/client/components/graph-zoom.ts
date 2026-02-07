export type GraphZoomState = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type GraphPoint = {
  x: number;
  y: number;
};

export const GRAPH_ZOOM_MIN_SCALE = 1;
export const GRAPH_ZOOM_MAX_SCALE = 5;
export const GRAPH_ZOOM_STEP = 0.2;
export const GRAPH_DRAG_CLICK_THRESHOLD_PX = 4;

export const createDefaultGraphZoomState = (): GraphZoomState => {
  return {
    scale: 1,
    translateX: 0,
    translateY: 0,
  };
};

export const clampGraphZoomScale = (
  scale: number,
  minScale = GRAPH_ZOOM_MIN_SCALE,
  maxScale = GRAPH_ZOOM_MAX_SCALE,
) => {
  return Math.min(maxScale, Math.max(minScale, scale));
};

export const zoomGraphToScaleAtPoint = (
  state: GraphZoomState,
  targetScale: number,
  focalPoint: GraphPoint,
  minScale = GRAPH_ZOOM_MIN_SCALE,
  maxScale = GRAPH_ZOOM_MAX_SCALE,
): GraphZoomState => {
  const clampedScale = clampGraphZoomScale(targetScale, minScale, maxScale);
  if (clampedScale === state.scale) {
    return state;
  }
  const ratio = clampedScale / state.scale;
  const nextTranslateX = focalPoint.x - (focalPoint.x - state.translateX) * ratio;
  const nextTranslateY = focalPoint.y - (focalPoint.y - state.translateY) * ratio;
  return {
    scale: clampedScale,
    translateX: nextTranslateX,
    translateY: nextTranslateY,
  };
};

export const zoomGraphByStepAtPoint = (
  state: GraphZoomState,
  direction: -1 | 1,
  focalPoint: GraphPoint,
  step = GRAPH_ZOOM_STEP,
  minScale = GRAPH_ZOOM_MIN_SCALE,
  maxScale = GRAPH_ZOOM_MAX_SCALE,
): GraphZoomState => {
  const targetScale = state.scale + step * direction;
  return zoomGraphToScaleAtPoint(state, targetScale, focalPoint, minScale, maxScale);
};

export const panGraphByDelta = (
  state: GraphZoomState,
  deltaX: number,
  deltaY: number,
): GraphZoomState => {
  return {
    scale: state.scale,
    translateX: state.translateX + deltaX,
    translateY: state.translateY + deltaY,
  };
};

export const formatGraphZoomPercent = (scale: number) => {
  return `${Math.round(scale * 100)}%`;
};

export const createGraphTransform = (state: GraphZoomState) => {
  return `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
};

export const didGraphDragExceedThreshold = (
  deltaX: number,
  deltaY: number,
  threshold = GRAPH_DRAG_CLICK_THRESHOLD_PX,
) => {
  return Math.hypot(deltaX, deltaY) > threshold;
};
