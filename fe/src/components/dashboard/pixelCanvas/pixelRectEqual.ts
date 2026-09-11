import type { PixelRect } from "./geometry";

export function pixelRectsNearlyEqual(
  a: PixelRect | undefined,
  b: PixelRect | undefined,
  epsilon = 0.5,
): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.x - b.x) < epsilon &&
    Math.abs(a.y - b.y) < epsilon &&
    Math.abs(a.width - b.width) < epsilon &&
    Math.abs(a.height - b.height) < epsilon
  );
}
