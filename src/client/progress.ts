import type { PrdProgress } from "./api";
import { createIcon } from "./icons";

export const normalizeProgress = (progress?: PrdProgress | null): PrdProgress => {
  if (progress === "in_progress" || progress === "done") {
    return progress;
  }
  return "not_started";
};

export const progressToIcon = (progress: PrdProgress): SVGSVGElement => {
  if (progress === "done") return createIcon("check-circle", "icon icon--lg");
  if (progress === "in_progress") return createIcon("bolt", "icon icon--lg");
  return createIcon("stop", "icon icon--lg");
};

export const progressToLabel = (progress: PrdProgress): string => {
  if (progress === "done") return "Done";
  if (progress === "in_progress") return "In progress";
  return "Not started";
};
