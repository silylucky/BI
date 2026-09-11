import type { MarkLineGuide } from "./pixelMarkLine";

export function markLineGuidesEqual(
  previous: MarkLineGuide[],
  next: MarkLineGuide[],
): boolean {
  if (previous.length !== next.length) return false;
  return previous.every(
    (guide, index) =>
      guide.id === next[index]?.id && guide.position === next[index]?.position,
  );
}
