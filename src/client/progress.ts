import type { PrdProgress } from "./api";

const notStartedEmoji = String.fromCodePoint(0x2b1c);
const inProgressEmoji = String.fromCodePoint(0x1f504);
const doneEmoji = String.fromCodePoint(0x2705);

export const normalizeProgress = (progress?: PrdProgress | null): PrdProgress => {
  if (progress === "in_progress" || progress === "done") {
    return progress;
  }
  return "not_started";
};

export const progressToEmoji = (progress: PrdProgress): string => {
  if (progress === "done") return doneEmoji;
  if (progress === "in_progress") return inProgressEmoji;
  return notStartedEmoji;
};

export const progressToLabel = (progress: PrdProgress): string => {
  if (progress === "done") return "Done";
  if (progress === "in_progress") return "In progress";
  return "Not started";
};
